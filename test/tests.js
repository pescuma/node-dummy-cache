var cache = process.env.CACHE_COVERAGE ? require('../lib-cov/dummy-cache.js') : require('../lib/dummy-cache.js');

// Internals copied here to test
var TYPE_VALUE = 1;
var TYPE_CALLBACK = 2;
var TYPE_PROMISE = 3;

exports['create'] = {
	c: undefined,
	
	setUp: function(callback) {
		cache.SET_MIN_CLEANUP_TIME(10);
		
		callback();
	},
	
	tearDown: function(callback) {
		c.shutdown();
		
		callback();
	},
	
	noArgs: function(test) {
		c = cache.create();
		
		test.equals(c.type, TYPE_VALUE);
		test.equals(c.maxAliveTimeMs, cache.NEVER_EXPIRES);
		test.equals(c.maxNotAccessedTimeMs, cache.NEVER_EXPIRES);
		test.equals(c.onErrorMaxAliveTimeMs, cache.NEVER_EXPIRES);
		test.strictEqual(c.fetcher, undefined);
		test.done();
	},
	
	optsPromiseFull: function(test) {
		var f = function() {
		};
		c = cache.create({
			type: cache.PROMISE,
			maxAliveTimeMs: 1,
			maxNotAccessedTimeMs: 2,
			onErrorMaxAliveTimeMs: 3
		}, f);
		
		test.equals(c.type, TYPE_PROMISE);
		test.equals(c.maxAliveTimeMs, 1);
		test.equals(c.maxNotAccessedTimeMs, 2);
		test.equals(c.onErrorMaxAliveTimeMs, 3);
		test.strictEqual(c.fetcher, f);
		test.done();
	},
	
	optsCallbackFull: function(test) {
		var f = function() {
		};
		c = cache.create({
			type: cache.CALLBACK,
			maxAliveTimeMs: 1,
			maxNotAccessedTimeMs: 2,
			onErrorMaxAliveTimeMs: 3
		}, f);
		
		test.equals(c.type, TYPE_CALLBACK);
		test.equals(c.maxAliveTimeMs, 1);
		test.equals(c.maxNotAccessedTimeMs, 2);
		test.equals(c.onErrorMaxAliveTimeMs, 3);
		test.strictEqual(c.fetcher, f);
		test.done();
	},
	
	args4: function(test) {
		var f = function() {
		};
		c = cache.create(cache.PROMISE, 1, 2, f);
		
		test.equals(c.type, TYPE_PROMISE);
		test.equals(c.maxAliveTimeMs, 1);
		test.equals(c.maxNotAccessedTimeMs, 2);
		test.equals(c.onErrorMaxAliveTimeMs, cache.NEVER_EXPIRES);
		test.strictEqual(c.fetcher, f);
		test.done();
	},
};

exports['Put/get tests'] = {
	c: undefined,
	
	setUp: function(callback) {
		cache.SET_MIN_CLEANUP_TIME(10);
		
		callback();
	},
	
	tearDown: function(callback) {
		c.shutdown();
		
		callback();
	},
	
	'Simple cache': function(test) {
		c = cache.create();
		
		test.strictEqual(c.get(1), undefined);
		
		c.put(1, 'A');
		
		test.equal(c.get(1), 'A');
		
		test.done();
	},
	
	'Multiple values': function(test) {
		c = cache.create();
		
		c.put(1, 'A');
		c.put(2, 'B');
		
		test.equal(c.get(1), 'A');
		test.equal(c.get(2), 'B');
		
		test.done();
	},
	
	'Cache with timer': function(test) {
		c = cache.create(10);
		
		test.strictEqual(c.get(1), undefined);
		
		c.put(1, 'A');
		
		test.equal(c.get(1), 'A');
		
		setTimeout(function() {
			test.strictEqual(c.get(1), undefined);
			
			test.expect(3);
			test.done();
		}, 30);
	},
	
	'Remove': function(test) {
		c = cache.create();
		
		c.put(1, 'A');
		
		test.equal(c.get(1), 'A');
		
		c.remove(1);
		
		test.strictEqual(c.get(1), undefined);
		
		test.done();
	},
	
	'Remove multiple': function(test) {
		c = cache.create();
		
		c.put(1, 'A');
		c.put(2, 'B');
		
		test.equal(c.get(1), 'A');
		test.equal(c.get(2), 'B');
		
		c.remove(2);
		
		test.equal(c.get(1), 'A');
		test.strictEqual(c.get(2), undefined);
		
		c.remove(1);
		
		test.strictEqual(c.get(1), undefined);
		test.strictEqual(c.get(2), undefined);
		
		test.done();
	},
};

exports['Fetch with callback tests'] = {
	c: undefined,
	
	setUp: function(callback) {
		cache.SET_MIN_CLEANUP_TIME(10);
		
		callback();
	},
	
	tearDown: function(callback) {
		c.shutdown();
		
		callback();
	},
	
	'Simple get': function(test) {
		c = cache.create(function(id, callback) {
			callback(undefined, 'A');
		});
		
		c.get(1, function(err, data) {
			test.equal(data, 'A');
		});
		
		test.expect(1);
		test.done();
	},
	
	'Simple cache': function(test) {
		c = cache.create(function(id, callback) {
			callback(undefined, 'A');
		});
		
		c.get(1, function(err, data) {
			test.equal(data, 'A');
		});
		
		c.get(1, function(err, data) {
			test.equal(data, 'A');
		});
		
		test.expect(2);
		test.done();
	},
	
	'Multiple values': function(test) {
		c = cache.create(function(id, callback) {
			callback(undefined, 'A' + id);
		});
		
		c.get(1, function(err, data) {
			test.equal(data, 'A1');
		});
		
		c.get(2, function(err, data) {
			test.equal(data, 'A2');
		});
		
		test.expect(2);
		test.done();
	},
	
	'Simple cache plus get': function(test) {
		c = cache.create(function(id, callback) {
			callback(undefined, 'A');
		});
		
		test.strictEqual(c.get(1), undefined);
		
		c.get(1, function(err, data) {
			test.equal(c.get(1), 'A');
		});
		
		test.expect(2);
		test.done();
	},
	
	'Invalidate with timer': function(test) {
		c = cache.create(10, function(id, callback) {
			callback(undefined, 'A');
		});
		
		test.strictEqual(c.get(1), undefined);
		
		c.get(1, function(err, data) {
			test.equal(data, 'A');
			test.equal(c.get(1), 'A');
			
			setTimeout(function() {
				test.strictEqual(c.get(1), undefined);
				
				test.done();
			}, 30);
		});
	},
	
	'Two gets result in only one method call': function(test) {
		var calls = 0;
		var notifies = 0;
		
		var cb;
		c = cache.create(function(id, callback) {
			calls++;
			cb = callback;
		});
		
		c.get(1, function(err, data) {
			notifies++;
		});
		
		test.equal(calls, 1);
		test.equal(notifies, 0);
		
		c.get(1, function(err, data) {
			notifies++;
		});
		
		test.equal(calls, 1);
		test.equal(notifies, 0);
		
		c.get(1, function(err, data) {
			notifies++;
		});
		
		test.equal(calls, 1);
		test.equal(notifies, 0);
		
		cb();
		
		test.equal(calls, 1);
		test.equal(notifies, 3);
		
		test.expect(8);
		test.done();
	},
	
	'Timeout during fetch': function(test) {
		var cb;
		c = cache.create(10, function(id, callback) {
			cb = callback;
		});
		
		var notifies = 0;
		c.get(1, function(err, data) {
			notifies++;
		});
		
		test.equal(notifies, 0);
		
		setTimeout(function() {
			
			test.equal(notifies, 0);
			
			cb();
			
			test.equal(notifies, 1);
			
			test.done();
		}, 50);
	},
	
	'Get as promise': function(test) {
		c = cache.create(function(id, callback) {
			callback(undefined, 'A');
		});
		
		c.getAsPromise(1)
			.then(function(data) {
				test.equal(data, 'A');
				
				test.done();
			});
	},
};

exports['Fetch with promise tests'] = {
	c: undefined,
	
	setUp: function(callback) {
		cache.SET_MIN_CLEANUP_TIME(10);
		
		callback();
	},
	
	tearDown: function(callback) {
		c.shutdown();
		
		callback();
	},
	
	'Simple get': function(test) {
		c = cache.create(cache.PROMISE, function(id) {
			return Promise.resolve('A');
		});
		
		c.get(1)
			.then(function(data) {
				test.equal(data, 'A');
				test.done();
			});
	},
	
	'Simple cache': function(test) {
		c = cache.create(cache.PROMISE, function(id) {
			return Promise.resolve('A');
		});
		
		c.get(1)
			.then(function(data) {
				test.equal(data, 'A');
				
				return c.get(1)
			})
			.then(function(data) {
				test.equal(data, 'A');
				
				test.expect(2);
				test.done();
			});
	},
	
	'Simple cache plus get value': function(test) {
		c = cache.create(cache.PROMISE, function(id) {
			return Promise.resolve('A');
		});
		
		c.get(1)
			.then(function(data) {
				test.equal(data, 'A');
				test.equal(c.getValue(1), 'A');
				
				test.done();
			});
	},
	
	'Multiple values': function(test) {
		c = cache.create(cache.PROMISE, function(id) {
			return Promise.resolve('A' + id);
		});
		
		c.get(1)
			.then(function(data) {
				test.equal(data, 'A1');
				
				return c.get(2);
			})
			.then(function(data) {
				test.equal(data, 'A2');
				
				test.expect(2);
				test.done();
			});
	},
	
	'Two gets result in only one method call': function(test) {
		var calls = 0;
		c = cache.create(cache.PROMISE, function(id) {
			calls++;
			return Promise.resolve('A');
		});
		
		c.get(1)
			.then(function(data) {
				test.equal(calls, 1);
				
				return c.get(1);
			})
			.then(function(data) {
				test.equal(calls, 1);
				
				test.done();
			});
	},
	
	'Invalidation by timer': function(test) {
		c = cache.create(cache.PROMISE, 10, function(id) {
			return Promise.resolve('A');
		});
		
		c.get(1)
			.then(function(data) {
				test.equal(data, 'A');
			});
		
		setTimeout(function() {
			test.strictEqual(c.getValue(1), undefined);
			
			test.done();
		}, 30);
	},
	
	'Timeout during fetch': function(test) {
		var cb;
		c = cache.create(cache.PROMISE, 10, function(id) {
			return new Promise(function(resolve, reject) {
				cb = resolve;
			});
		});
		
		var notifies = 0;
		c.get(1)
			.then(function(data) {
				notifies++;
			});
		
		test.equal(notifies, 0);
		
		setTimeout(function() {
			test.equal(notifies, 0);
			
			cb('A');
			
			setTimeout(function() {
				test.equal(notifies, 1);
				
				test.done();
			}, 2);
		}, 50);
	},
	
	'Get as callback': function(test) {
		c = cache.create(cache.PROMISE, function(id) {
			return Promise.resolve('A');
		});
		
		c.getAsCallback(1, function(err, data) {
			test.equal(data, 'A');
			
			test.done();
		});
	},
};

exports['Function wrapper'] = {
	c: undefined,
	
	setUp: function(callback) {
		cache.SET_MIN_CLEANUP_TIME(10);
		
		callback();
	},
	
	tearDown: function(callback) {
		c.shutdown();
		
		callback();
	},
	
	'1 param + callback': function(test) {
		c = cache.create(function(p1, callback) {
			test.equal(p1, 1);
			
			callback('A', 'B', 'C');
		});
		
		c.get(1, function(a, b, c) {
			test.equal(a, 'A');
			test.equal(b, 'B');
			test.equal(c, 'C');
			
			test.done();
		});
	},
	
	'2 params + callback': function(test) {
		c = cache.create(function(p1, p2, callback) {
			test.equal(p1, 1);
			test.equal(p2, 2);
			
			callback('A', 'B', 'C');
		});
		
		c.get(1, 2, function(a, b, c) {
			test.equal(a, 'A');
			test.equal(b, 'B');
			test.equal(c, 'C');
			
			test.done();
		});
	},
	
	'0 params + callback': function(test) {
		c = cache.create(function(callback) {
			callback('A', 'B', 'C');
		});
		
		c.get(function(a, b, c) {
			test.equal(a, 'A');
			test.equal(b, 'B');
			test.equal(c, 'C');
			
			test.done();
		});
	},
	
	'Function style': function(test) {
		c = cache.create(function(a, b, c, callback) {
			test.equal(a, 1);
			test.equal(b, 2);
			test.equal(c, 3);
			
			callback('A', 'B', 'C');
		});
		
		c(1, 2, 3, function(err, data1, data2) {
			test.equal(err, 'A');
			test.equal(data1, 'B');
			test.equal(data2, 'C');
			
			test.done();
		});
	},
	
	'Function style mixed': function(test) {
		c = cache.create(function(a, b, c, callback) {
			test.equal(a, 1);
			test.equal(b, 2);
			test.equal(c, 3);
			
			callback(undefined, 'A');
		});
		
		test.strictEqual(c(1, 2, 3), undefined);
		
		c(1, 2, 3, function(err, data) {
			test.strictEqual(err, undefined);
			test.equal(data, 'A');
		});
		
		test.strictEqual(c(1, 2, 3), 'A');
		
		test.expect(7);
		test.done();
	},
	
	'Function style with timer': function(test) {
		c = cache.create(10, function(a, b, c, callback) {
			test.equal(a, 1);
			test.equal(b, 2);
			test.equal(c, 3);
			
			callback(undefined, 'A');
		});
		
		test.strictEqual(c(1, 2, 3), undefined);
		
		c(1, 2, 3, function(err, data) {
			test.strictEqual(err, undefined);
			test.equal(data, 'A');
		});
		
		test.equal(c(1, 2, 3), 'A');
		
		setTimeout(function() {
			test.strictEqual(c(1, 2, 3), undefined);
			
			test.expect(8);
			test.done();
		}, 50);
	},
};
