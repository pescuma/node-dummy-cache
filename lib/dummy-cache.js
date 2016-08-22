var TYPE_GUESS = 0;
var TYPE_VALUE = 1;
var TYPE_CALLBACK = 2;
var TYPE_PROMISE = 3;

var cacheFactory = {
	NEVER_EXPIRES: -1,
	ONLY_DURING_EXECUTION: -2,
	MIN_CLEANUP_TIME: 10 * 60 * 1000,
	ONE_SECOND: 1000,
	ONE_MINUTE: 60 * 1000,
	ONE_HOUR: 60 * 60 * 1000,
	ONE_DAY: 24 * 60 * 60 * 1000,
	CALLBACK: 'callback',
	PROMISE: 'promise',
	
	create: function() {
		var data = {};
		var timer = 0;
		
		var self = function() {
			return self.get.apply(this, arguments);
		};
		
		var toArgs = function(args) {
			return [].slice.apply(args, []);
		};
		
		var now = function() {
			return new Date().getTime();
		};
		
		var runCleanup = function() {
			stopTimer();
			
			var date = now();
			
			for (var id in data) {
				if (!data.hasOwnProperty(id))
					continue;
				
				var entry = data[id];
				if (!isValid(entry, date) && !entry.fetching)
					self.remove(id);
			}
			
			startTimer();
		};
		
		var stopTimer = function() {
			if (timer) {
				clearTimeout(timer);
				timer = 0;
			}
		};
		
		var startTimer = function() {
			stopTimer();
			
			var timeMs = Number.MAX_VALUE;
			
			if (self.maxAliveTimeMs > 0)
				timeMs = Math.min(timeMs, self.maxAliveTimeMs);
			
			if (self.maxNotAccessedTimeMs > 0)
				timeMs = Math.min(timeMs, self.maxNotAccessedTimeMs);
			
			if (self.onErrorMaxAliveTimeMs > 0)
				timeMs = Math.min(timeMs, self.onErrorMaxAliveTimeMs);
			
			if (timeMs !== Number.MAX_VALUE)
				timer = setTimeout(runCleanup, Math.max(timeMs, cacheFactory.MIN_CLEANUP_TIME));
		};
		
		var checkIsValid = function(time, delta, date) {
			if (delta === cacheFactory.ONLY_DURING_EXECUTION)
				return false;
			
			if (delta > 0 && time + delta < date)
				return false;
			
			return true;
		};
		
		var isValid = function(entry, date) {
			if (!entry.created)
				return false;
			
			if (!date)
				date = now();
			
			if (!checkIsValid(entry.created, self.maxAliveTimeMs, date))
				return false;
			
			if (!checkIsValid(entry.lastTouch, self.maxNotAccessedTimeMs, date))
				return false;
			
			if (entry.args[0] && !checkIsValid(entry.created, self.onErrorMaxAliveTimeMs, date))
				return false;
			
			return true;
		};
		
		var getData = function(id) {
			var result = data[id];
			
			if (!result) {
				result = { id: id };
				data[id] = result;
			}
			
			return result;
		};
		
		var createId = function(args) {
			return JSON.stringify(args);
		};
		
		var splitArguments = function(args, lastShouldBeCallback) {
			var params = toArgs(args);
			
			var callback;
			if (params.length > 0) {
				if (lastShouldBeCallback === true) {
					callback = params.pop();
				} else if (lastShouldBeCallback === false) {
					// Do nothing
				} else if (typeof params[params.length - 1] === 'function') {
					callback = params.pop();
				}
			}
			
			if ((callback || lastShouldBeCallback) && typeof callback !== 'function')
				throw Error('Last argument should be a function');
			
			return {
				id: createId(params),
				params: params,
				callback: callback
			};
		};
		
		var onCompletion = function(result, args) {
			var date = now();
			result.created = date;
			result.lastTouch = date;
			result.args = args;
			
			var callbacks = result.callbacks;
			
			delete result.fetching;
			delete result.callbacks;
			
			if (self.maxAliveTimeMs === cacheFactory.ONLY_DURING_EXECUTION || self.maxNotAccessedTimeMs === cacheFactory.ONLY_DURING_EXECUTION)
				self.remove(result.id);
			
			if (args[0] && self.onErrorMaxAliveTimeMs === cacheFactory.ONLY_DURING_EXECUTION)
				self.remove(result.id);
			
			for (var i = 0; i < callbacks.length; ++i)
				callbacks[i].apply(null, args);
		};
		
		var promiseToCallback = function(resolve, reject) {
			return function(err, value) {
				if (err)
					reject(err);
				else
					resolve(value);
			};
		};
		
		var fetch = function(originalThis, args, result) {
			delete result.created;
			result.fetching = true;
			result.callbacks = [];
			
			switch (self.type) {
				case TYPE_PROMISE:
					self.fetcher.apply(originalThis, args.params)
						.then(function(value) {
								onCompletion(result, [undefined, value]);
							},
							function(err) {
								onCompletion(result, [err]);
							});
					break;
				
				case TYPE_CALLBACK:
					args.params.push(function() {
						onCompletion(result, toArgs(arguments));
					});
					
					self.fetcher.apply(originalThis, args.params);
					break;
			}
		};
		
		var get = function(originalThis, returnType, args) {
			var lastShouldBeCallback;
			if (returnType === TYPE_VALUE || returnType === TYPE_PROMISE || (returnType === TYPE_GUESS && self.type === TYPE_PROMISE))
				lastShouldBeCallback = false;
			else if (returnType === TYPE_CALLBACK)
				lastShouldBeCallback = true;
			
			args = splitArguments(args, lastShouldBeCallback);
			
			if (returnType === TYPE_GUESS) {
				if (self.type === TYPE_PROMISE)
					returnType = TYPE_PROMISE;
				else if (self.type === TYPE_CALLBACK && args.callback)
					returnType = TYPE_CALLBACK;
				else
					returnType = TYPE_VALUE;
			}
			
			var result = getData(args.id);
			var canFetch = (returnType !== TYPE_VALUE && self.type !== TYPE_VALUE);
			var date = now();
			
			var valid = isValid(result, date);
			
			if (!valid && canFetch && !result.fetching) {
				fetch(originalThis, args, result);
				if (!result.fetching)
					valid = true;
			}
			
			if (valid) {
				result.lastTouch = date;
				
				switch (returnType) {
					case TYPE_PROMISE:
						if (result.args[0])
							return Promise.reject(result.args[0]);
						else
							return Promise.resolve(result.args[1]);
					
					case TYPE_CALLBACK:
						args.callback.apply(null, result.args);
						return undefined;
					
					case TYPE_VALUE:
						if (result.args[0])
							return undefined;
						else
							return result.args[1];
				}
				
			} else if (result.fetching) {
				switch (returnType) {
					case TYPE_PROMISE:
						return new Promise(function(resolve, reject) {
							result.callbacks.push(promiseToCallback(resolve, reject));
						});
					
					case TYPE_CALLBACK:
						result.callbacks.push(args.callback);
						return undefined;
				}
			}
			
			return undefined;
		};
		
		self.get = function() {
			return get(this, TYPE_GUESS, toArgs(arguments));
		};
		self.getValue = function() {
			return get(this, TYPE_VALUE, toArgs(arguments));
		};
		self.getAsCallback = function() {
			return get(this, TYPE_CALLBACK, toArgs(arguments));
		};
		self.getAsPromise = function() {
			return get(this, TYPE_PROMISE, toArgs(arguments));
		};
		
		self.put = function() {
			var args = toArgs(arguments);
			var value = args.pop();
			var id = createId(args);
			var date = now();
			var result = getData(id);
			
			result.created = date;
			result.lastTouch = date;
			result.args = [undefined, value];
		};
		
		self.remove = function() {
			var args = splitArguments(arguments, false);
			delete data[args.id];
		};
		
		self.clear = function() {
			data = {};
		};
		
		self.invalidate = function() {
			if (arguments.length > 0)
				self.remove.apply(this, arguments);
			else
				self.clear();
		};
		
		self.shutdown = function() {
			stopTimer();
			self.clear();
		};
		
		var assertTypes = function() {
			var args = arguments[0];
			var types = toArgs(arguments).splice(1);
			
			if (args.length !== types.length)
				throw new Error('Wrong number of arguments. Should be ' + types.length);
			
			for (var i = 0; i < types.length; ++i) {
				var actual = typeof args[i];
				if (types[i] !== actual)
					throw new Error('Wrong argument type for argument ' + i + ': expected ' + types[i] + ', actual '
						+ actual);
			}
		};
		
		var toType = function(name) {
			if (name === cacheFactory.PROMISE)
				return TYPE_PROMISE;
			else if (name === cacheFactory.CALLBACK)
				return TYPE_CALLBACK;
			else
				throw Error('Unknown type: ' + name);
		};
		
		var args = toArgs(arguments);
		
		if (args.length > 4)
			throw new Error('Wrong arguments');
		
		self.maxNotAccessedTimeMs = cacheFactory.NEVER_EXPIRES;
		self.maxAliveTimeMs = cacheFactory.NEVER_EXPIRES;
		self.onErrorMaxAliveTimeMs = cacheFactory.NEVER_EXPIRES;
		self.fetcher = undefined;
		
		if (args.length === 4) {
			assertTypes(args, 'string', 'number', 'number', 'function');
			self.type = toType(args[0]);
			self.maxAliveTimeMs = args[1];
			self.maxNotAccessedTimeMs = args[2];
			self.fetcher = args[3];
			
		} else if (args.length === 3) {
			if (typeof args[0] === 'string') {
				assertTypes(args, 'string', 'number', 'function');
				self.type = toType(args[0]);
				self.maxAliveTimeMs = args[1];
				self.fetcher = args[2];
				
			} else {
				assertTypes(args, 'number', 'number', 'function');
				self.type = TYPE_CALLBACK;
				self.maxAliveTimeMs = args[0];
				self.maxNotAccessedTimeMs = args[1];
				self.fetcher = args[2];
			}
			
		} else if (args.length === 2) {
			if (typeof args[0] === 'object' && typeof args[1] === 'function') {
				self.type = TYPE_CALLBACK;
				self.fetcher = args[1];
				
				var opts = args[0];
				if (opts.type !== undefined)
					self.type = toType(opts.type);
				if (opts.maxNotAccessedTimeMs !== undefined)
					self.maxNotAccessedTimeMs = opts.maxNotAccessedTimeMs;
				if (opts.maxAliveTimeMs !== undefined)
					self.maxAliveTimeMs = opts.maxAliveTimeMs;
				if (opts.onErrorMaxAliveTimeMs !== undefined)
					self.onErrorMaxAliveTimeMs = opts.onErrorMaxAliveTimeMs;
				
			} else if (typeof args[0] === 'string' && typeof args[1] === 'function') {
				self.type = toType(args[0]);
				self.fetcher = args[1];
				
			} else if (typeof args[1] === 'function') {
				assertTypes(args, 'number', 'function');
				self.type = TYPE_CALLBACK;
				self.maxAliveTimeMs = args[0];
				self.fetcher = args[1];
				
			} else {
				assertTypes(args, 'number', 'number');
				self.type = TYPE_VALUE;
				self.maxAliveTimeMs = args[0];
				self.maxNotAccessedTimeMs = args[1];
			}
			
		} else if (args.length === 1) {
			if (typeof args[0] === 'function') {
				self.type = TYPE_CALLBACK;
				self.fetcher = args[0];
				
			} else {
				assertTypes(args, 'number');
				self.type = TYPE_VALUE;
				self.maxAliveTimeMs = args[0];
			}
			
		} else {
			self.type = TYPE_VALUE;
		}
		
		startTimer();
		
		return self;
	},
	
	SET_MIN_CLEANUP_TIME: function(timeMs) {
		cacheFactory.MIN_CLEANUP_TIME = Math.max(timeMs, 1);
	}
};

if (exports !== undefined) {
	exports.create = cacheFactory.create;
	exports.NEVER_EXPIRES = cacheFactory.NEVER_EXPIRES;
	exports.ONLY_DURING_EXECUTION = cacheFactory.ONLY_DURING_EXECUTION;
	exports.MIN_CLEANUP_TIME = cacheFactory.MIN_CLEANUP_TIME;
	exports.ONE_SECOND = cacheFactory.ONE_SECOND;
	exports.ONE_MINUTE = cacheFactory.ONE_MINUTE;
	exports.ONE_HOUR = cacheFactory.ONE_HOUR;
	exports.ONE_DAY = cacheFactory.ONE_DAY;
	exports.SET_MIN_CLEANUP_TIME = cacheFactory.SET_MIN_CLEANUP_TIME;
	exports.CALLBACK = cacheFactory.CALLBACK;
	exports.PROMISE = cacheFactory.PROMISE;
}
