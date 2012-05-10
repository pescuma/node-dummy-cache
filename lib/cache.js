var NEVER_EXPIRES = -1;
var MIN_TIME = 500;
var ONE_SECOND = 1000;
var ONE_MINUTE = 1000 * 60;
var ONE_HOUR = 1000 * 60 * 60;

function Cache(args) {
	var self = this;

	self.maxNotAccessedTimeMs = NEVER_EXPIRES;
	self.maxAliveTimeMS = NEVER_EXPIRES;
	self.fetcher = undefined;
	var data = {};
	var timer = 0;

	var toArgs = function(args) {
		return [].slice.apply(args, []);
	};

	var now = function() {
		return new Date().getTime();
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
			timer = setTimeout(invalidate, Math.max(timeMs, MIN_TIME));
	};

	var isValid = function(entry, date) {
		if (entry.created < 0)
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
			result = {
				lastTouch : -1,
				created : -1
			};
			data[id] = result;
		}

		return result;
	};

	self.get = function(id, callback) {
		var date = now();
		var result = getData(id);

		if (isValid(result, date)) {
			result.lastTouch = date;

			if (callback)
				callback.apply(null, result.args);

			if (result.args[0])
				return undefined;
			else
				return result.args[1];
		}

		if (callback) {
			self.fetcher(id, function() {
				var date = now();
				result.created = date;
				result.lastTouch = date;
				result.args = toArgs(arguments);
				callback.apply(null, result.args);
			});
		}

		return undefined;
	};

	self.put = function(id, value) {
		var date = now();
		var result = getData(id);
		result.created = date;
		result.lastTouch = date;
		result.args = [ undefined, value ];
	};

	self.remove = function(id) {
		delete data[id];
	};

	self.clear = function() {
		data = {};
	};

	self.shutdown = function() {
		stopTimer();
	};

	var invalidate = function() {
		stopTimer();

		var date = now();

		for ( var id in data) {
			if (!isValid(data[id], date))
				self.remove(id);
		}

		startTimer();
	};

	var assertTypes = function() {
		var args = arguments[0];
		var types = toArgs(arguments).splice(1);

		if (args.length != types.length)
			throw new Error('Wrong number of arguments. Should be ' + types.length);

		for ( var i in types) {
			var actual = typeof args[i];
			if (types[i] != actual)
				throw new Error('Wrong argument type for argument ' + i + ': expected ' + types[i] + ', actual '
						+ actual);
		}
	};

	if (args.length > 3)
		throw new Error('Wrong arguments');

	if (args.length == 3) {
		assertTypes(args, 'number', 'number', 'function');
		self.maxAliveTimeMS = args[0];
		self.maxNotAccessedTimeMs = args[1];
		self.fetcher = args[2];

	} else if (args.length == 2) {
		if (typeof args[1] == 'function') {
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
}

exports.create = function() {
	return new Cache(arguments);
};

exports.NEVER_EXPIRES = NEVER_EXPIRES;
exports.MIN_TIME = MIN_TIME;
exports.ONE_SECOND = ONE_SECOND;
exports.ONE_MINUTE = ONE_MINUTE;
exports.ONE_HOUR = ONE_HOUR;
