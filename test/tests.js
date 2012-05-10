var cache = require('../lib/cache.js');

exports['Clear cache'] = {

};

exports['Put/get tests'] = {
	c : undefined,

	setUp : function(callback) {
		// Set min time for the invalidate
		cache.MIN_TIME = 10;

		callback();
	},

	tearDown : function(callback) {
		c.shutdown();

		callback();
	},

	'Simple cache' : function(test) {
		c = cache.create();

		test.strictEqual(c.get(1), undefined);

		c.put(1, 'A');

		test.equal(c.get(1), 'A');

		test.done();
	},

	'Cache with timer' : function(test) {
		c = cache.create(10);

		test.strictEqual(c.get(1), undefined);

		c.put(1, 'A');

		test.equal(c.get(1), 'A');

		setTimeout(function() {
			test.strictEqual(c.get(1), undefined);

			test.done();
		}, 30);
	},
};

exports['Fetch with callback tests'] = {
	c : undefined,

	setUp : function(callback) {
		// Set min time for the invalidate
		cache.MIN_TIME = 10;

		callback();
	},

	tearDown : function(callback) {
		c.shutdown();

		callback();
	},

	'Simple cache' : function(test) {
		c = cache.create(function(id, callback) {
			callback(undefined, 'A');
		});

		c.get(1, function(err, data) {
			test.equal(data, 'A');

			test.done();
		});
	},

	'Simple cache plus get' : function(test) {
		c = cache.create(function(id, callback) {
			callback(undefined, 'A');
		});

		test.strictEqual(c.get(1), undefined);

		c.get(1, function(err, data) {
			test.equal(c.get(1), 'A');

			test.done();
		});
	},

	'Cache with timer' : function(test) {
		c = cache.create(10, function(id, callback) {
			callback(undefined, 'A');
		});

		test.strictEqual(c.get(1), undefined);

		c.get(1, function(err, data) {
			test.equal(data, 'A');
			test.strictEqual(c.get(1), 'A');

			setTimeout(function() {
				test.strictEqual(c.get(1), undefined);
				
				test.done();
			}, 30);
		});
	},
};
