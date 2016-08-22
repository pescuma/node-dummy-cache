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
		
		var splitArguments = function(args, removeLast) {
			var params = toArgs(args);
			
			var callback;
			if (params.length > 0) {
				if (removeLast === true) {
					callback = params.pop();
				} else if (removeLast === false) {
					// Do nothing
				} else if (typeof params[params.length - 1] === 'function') {
					callback = params.pop();
				}
			}
			
			var id = JSON.stringify(params);
			
			return {
				params: params,
				callback: callback,
				id: id
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
		
		self.get = function() {
			var isPromise = (self.type === cacheFactory.PROMISE);
			var args = splitArguments(arguments, isPromise ? false : undefined);
			var date = now();
			var result = getData(args.id);
			var originalThis = this;
			var canFetch = isPromise || args.callback;
			
			if (isValid(result, date)) {
				result.lastTouch = date;
				
				if (isPromise) {
					if (result.args[0])
						return Promise.reject(result.args[0]);
					else
						return Promise.resolve(result.args[1]);
					
				} else if (args.callback) {
					args.callback.apply(null, result.args);
					return undefined;
					
				} else {
					if (result.args[0])
						return undefined;
					else
						return result.args[1];
				}
				
			} else if (result.fetching) {
				if (isPromise) {
					return new Promise(function(resolve, reject) {
						result.callbacks.push(promiseToCallback(resolve, reject));
					});
					
				} else if (args.callback) {
					result.callbacks.push(args.callback);
					return undefined;
				}
				
			} else if (canFetch) {
				result.fetching = true;
				result.callbacks = [];
				
				if (isPromise) {
					return new Promise(function(resolve, reject) {
						result.callbacks.push(promiseToCallback(resolve, reject));
						
						self.fetcher.apply(originalThis, args.params)
							.then(function(value) {
									onCompletion(result, [undefined, value]);
								},
								function(err) {
									onCompletion(result, [err]);
								});
					});
					
				} else if (args.callback) {
					result.callbacks.push(args.callback);
					
					args.params.push(function() {
						onCompletion(result, toArgs(arguments));
					});
					
					self.fetcher.apply(originalThis, args.params);
					return undefined;
				}
			}
			
			return undefined;
		};
		
		self.put = function() {
			var args = splitArguments(arguments, true);
			var date = now();
			var result = getData(args.id);
			
			result.created = date;
			result.lastTouch = date;
			result.args = [undefined, args.callback];
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
		
		var args = toArgs(arguments);
		
		if (args.length > 4)
			throw new Error('Wrong arguments');
		
		self.type = cacheFactory.CALLBACK;
		self.maxNotAccessedTimeMs = cacheFactory.NEVER_EXPIRES;
		self.maxAliveTimeMs = cacheFactory.NEVER_EXPIRES;
		self.onErrorMaxAliveTimeMs = cacheFactory.NEVER_EXPIRES;
		self.fetcher = undefined;
		
		if (args.length === 4) {
			assertTypes(args, 'string', 'number', 'number', 'function');
			self.type = args[0];
			self.maxAliveTimeMs = args[1];
			self.maxNotAccessedTimeMs = args[2];
			self.fetcher = args[3];
			
		} else if (args.length === 3) {
			if (typeof args[0] === 'string') {
				assertTypes(args, 'string', 'number', 'function');
				self.type = args[0];
				self.maxAliveTimeMs = args[1];
				self.fetcher = args[2];
				
			} else {
				assertTypes(args, 'number', 'number', 'function');
				self.maxAliveTimeMs = args[0];
				self.maxNotAccessedTimeMs = args[1];
				self.fetcher = args[2];
			}
			
		} else if (args.length === 2) {
			if (typeof args[0] === 'object' && typeof args[1] === 'function') {
				var opts = args[0];
				if (opts.type !== undefined)
					self.type = opts.type;
				if (opts.maxNotAccessedTimeMs !== undefined)
					self.maxNotAccessedTimeMs = opts.maxNotAccessedTimeMs;
				if (opts.maxAliveTimeMs !== undefined)
					self.maxAliveTimeMs = opts.maxAliveTimeMs;
				if (opts.onErrorMaxAliveTimeMs !== undefined)
					self.onErrorMaxAliveTimeMs = opts.onErrorMaxAliveTimeMs;
				self.fetcher = args[1];
				
			} else if (typeof args[0] === 'string' && typeof args[1] === 'function') {
				self.type = args[0];
				self.fetcher = args[1];
				
			} else if (typeof args[1] === 'function') {
				assertTypes(args, 'number', 'function');
				self.maxAliveTimeMs = args[0];
				self.fetcher = args[1];
				
			} else {
				assertTypes(args, 'number', 'number');
				self.maxAliveTimeMs = args[0];
				self.maxNotAccessedTimeMs = args[1];
			}
			
		} else if (args.length === 1) {
			if (typeof args[0] === 'function') {
				self.fetcher = args[0];
				
			} else {
				assertTypes(args, 'number');
				self.maxAliveTimeMs = args[0];
			}
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
