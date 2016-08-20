var cacheFactory = {
	NEVER_EXPIRES: -1,
	MIN_TIME: 500,
	ONE_SECOND: 1000,
	ONE_MINUTE: 1000 * 60,
	ONE_HOUR: 1000 * 60 * 60,
	ONE_DAY: 24 * 1000 * 60 * 60,
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
		
		var invalidate = function() {
			stopTimer();
			
			var date = now();
			
			for (var id in data) {
				if (!isValid(data[id], date))
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
			
			var timeMs;
			
			if (self.maxAliveTimeMS > 0 && self.maxNotAccessedTimeMs > 0)
				timeMs = Math.min(self.maxAliveTimeMS, self.maxNotAccessedTimeMs);
			
			else if (self.maxAliveTimeMS > 0)
				timeMs = self.maxAliveTimeMS;
			
			else if (self.maxNotAccessedTimeMs > 0)
				timeMs = self.maxNotAccessedTimeMs;
			
			else
				timeMs = -1;
			
			if (timeMs > 0)
				timer = setTimeout(invalidate, Math.max(timeMs, cacheFactory.MIN_TIME));
		};
		
		var isValid = function(entry, date) {
			if (!entry.created)
				return false;
			
			if (!date)
				date = now();
			
			if (self.maxNotAccessedTimeMs > 0 && entry.lastTouch + self.maxNotAccessedTimeMs < date)
				return false;
			
			if (self.maxAliveTimeMS > 0 && entry.created + self.maxAliveTimeMS < date)
				return false;
			
			return true;
		};
		
		var getData = function(id) {
			var result = data[id];
			
			if (!result) {
				result = {};
				data[id] = result;
			}
			
			return result;
		};
		
		var splitArguments = function(args, removeLast) {
			var params = toArgs(args);
			
			var callback = undefined;
			if (params.length > 0) {
				if (removeLast === true) {
					callback = params.pop();
				} else if (removeLast === false) {
					// Do nothing
				} else if (typeof params[params.length - 1] == 'function') {
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
		
		self.get = function() {
			var isPromise = (self.type === 'promise');
			var args = splitArguments(arguments, isPromise ? false : undefined);
			var date = now();
			var result = getData(args.id);
			var originalThis = this;
			
			if (isPromise) {
				if (isValid(result, date)) {
					result.lastTouch = date;
					if (result.args[0])
						return Promise.reject(result.args[0]);
					else
						return Promise.resolve(result.args[1]);
				}
				
				if (result.fetching) {
					return new Promise(function(resolve, reject) {
						result.resolvers.push(resolve);
						result.rejecters.push(reject);
					});
					
				} else {
					result.fetching = true;
					result.resolvers = [];
					result.rejecters = [];
					
					var handler = function(err, value) {
						var date = now();
						result.created = date;
						result.lastTouch = date;
						result.args = [err, value];
						
						var i;
						if (err) {
							for (i = 0; i < result.rejecters.length; ++i)
								result.rejecters[i](err);
							
						} else {
							for (i = 0; i < result.resolvers.length; ++i)
								result.resolvers[i](value);
						}
						
						delete result.fetching;
						delete result.resolvers;
						delete result.rejecters;
					};
					
					return new Promise(function(resolve, reject) {
						result.resolvers.push(resolve);
						result.rejecters.push(reject);
						
						self.fetcher.apply(originalThis, args.params)
							.then(function(value) {
									handler(undefined, value);
								},
								function(error) {
									handler(error);
								});
					});
				}
				
			} else if (args.callback) {
				if (isValid(result, date)) {
					result.lastTouch = date;
					args.callback.apply(null, result.args);
					return undefined;
				}
				
				if (result.fetching) {
					result.callbacks.push(args.callback);
					return undefined;
					
				} else {
					result.fetching = true;
					result.callbacks = [args.callback];
					
					args.params.push(function() {
						var date = now();
						result.created = date;
						result.lastTouch = date;
						result.args = toArgs(arguments);
						
						for (var i = 0; i < result.callbacks.length; ++i)
							result.callbacks[i].apply(null, result.args);
						
						delete result.fetching;
						delete result.callbacks;
					});
					
					self.fetcher.apply(originalThis, args.params);
					return undefined;
				}
				
			} else {
				if (isValid(result, date)) {
					result.lastTouch = date;
					
					if (result.args[0])
						return undefined;
					else
						return result.args[1];
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
		};
		
		var assertTypes = function() {
			var args = arguments[0];
			var types = toArgs(arguments).splice(1);
			
			if (args.length != types.length)
				throw new Error('Wrong number of arguments. Should be ' + types.length);
			
			for (var i = 0; i < types.length; ++i) {
				var actual = typeof args[i];
				if (types[i] != actual)
					throw new Error('Wrong argument type for argument ' + i + ': expected ' + types[i] + ', actual '
						+ actual);
			}
		};
		
		var args = toArgs(arguments);
		
		if (args.length > 4)
			throw new Error('Wrong arguments');
		
		self.type = cacheFactory.CALLBACK;
		self.maxNotAccessedTimeMs = cacheFactory.NEVER_EXPIRES;
		self.maxAliveTimeMS = cacheFactory.NEVER_EXPIRES;
		self.fetcher = undefined;
		
		if (args.length == 4) {
			assertTypes(args, 'string', 'number', 'number', 'function');
			self.type = args[0];
			self.maxAliveTimeMS = args[1];
			self.maxNotAccessedTimeMs = args[2];
			self.fetcher = args[3];
			
		} else if (args.length == 3) {
			if (typeof args[0] == 'string') {
				assertTypes(args, 'string', 'number', 'function');
				self.type = args[0];
				self.maxAliveTimeMS = args[1];
				self.fetcher = args[2];
				
			} else {
				assertTypes(args, 'number', 'number', 'function');
				self.maxAliveTimeMS = args[0];
				self.maxNotAccessedTimeMs = args[1];
				self.fetcher = args[2];
			}
			
		} else if (args.length == 2) {
			if (typeof args[0] == 'object' && typeof args[1] == 'function') {
				var opts = args[0];
				if (opts.type !== undefined)
					self.type = opts.type;
				if (opts.maxNotAccessedTimeMs !== undefined)
					self.maxNotAccessedTimeMs = opts.maxNotAccessedTimeMs;
				if (opts.maxAliveTimeMS !== undefined)
					self.maxAliveTimeMS = opts.maxAliveTimeMS;
				self.fetcher = args[1];
				
			} else if (typeof args[0] == 'string' && typeof args[1] == 'function') {
				self.type = args[0];
				self.fetcher = args[1];
				
			} else if (typeof args[1] == 'function') {
				assertTypes(args, 'number', 'function');
				self.maxAliveTimeMS = args[0];
				self.fetcher = args[1];
				
			} else {
				assertTypes(args, 'number', 'number');
				self.maxAliveTimeMS = args[0];
				self.maxNotAccessedTimeMs = args[1];
			}
			
		} else if (args.length == 1) {
			if (typeof args[0] == 'function') {
				self.fetcher = args[0];
				
			} else {
				assertTypes(args, 'number');
				self.maxAliveTimeMS = args[0];
			}
		}
		
		startTimer();
		
		return self;
	},
	
	SET_MIN_TIME: function(timeMs) {
		cacheFactory.MIN_TIME = Math.max(timeMs, 1);
	}
};

if (typeof exports != 'undefined') {
	exports.create = cacheFactory.create;
	exports.NEVER_EXPIRES = cacheFactory.NEVER_EXPIRES;
	exports.MIN_TIME = cacheFactory.MIN_TIME;
	exports.ONE_SECOND = cacheFactory.ONE_SECOND;
	exports.ONE_MINUTE = cacheFactory.ONE_MINUTE;
	exports.ONE_HOUR = cacheFactory.ONE_HOUR;
	exports.ONE_DAY = cacheFactory.ONE_DAY;
	exports.SET_MIN_TIME = cacheFactory.SET_MIN_TIME;
	exports.CALLBACK = cacheFactory.CALLBACK;
	exports.PROMISE = cacheFactory.PROMISE;
}