node-dummy-cache
================

A simple in memory cache to use with javascript.

[![npm](https://img.shields.io/npm/v/node-dummy-cache.svg?maxAge=2592000)](https://www.npmjs.com/package/node-dummy-cache)
[![Build Status](https://secure.travis-ci.org/pescuma/node-dummy-cache.png)](http://travis-ci.org/pescuma/node-dummy-cache)
[![Test Coverage](https://codeclimate.com/github/pescuma/node-dummy-cache/badges/coverage.svg)](https://codeclimate.com/github/pescuma/node-dummy-cache/coverage)
[![dependencies Status](https://david-dm.org/pescuma/node-dummy-cache/status.svg)](https://david-dm.org/pescuma/node-dummy-cache)
[![devDependencies Status](https://david-dm.org/pescuma/node-dummy-cache/dev-status.svg)](https://david-dm.org/pescuma/node-dummy-cache?type=dev)


## Installation

### node.js

	npm install node-dummy-cache

Import inside your code:

```javascript
var cacheFactory = require('node-dummy-cache');
```

### HTML

Download [lib/dummy-cache.js](https://raw.github.com/pescuma/node-dummy-cache/master/lib/dummy-cache.js).

Import inside HTML:

```html
<script type="text/javascript" src="dummy-cache.js"></script>
```

For old browsers you will also need [json2.js](https://raw.github.com/douglascrockford/JSON-js/master/json2.js).

## Usage

### Simple key/value

```javascript
var users = cacheFactory.create(cacheFactory.ONE_HOUR);

users.put(1, { name : 'A' });

var user = users.get(1);
```

### Function style

Before:

```javascript
function dummy(a, b, c, callback) {
	// Do complex stuff here
	callback(undefined, 'A', 'B');
};

dummy(1, 2, 3, function(err, data1, data2) {
	// You got it
});
```

Adding cache:

```javascript
var dummy = cacheFactory.create(cacheFactory.ONE_HOUR, function (a, b, c, callback) {
	// Do complex stuff here
	callback(undefined, 'A', 'B');
});

dummy(1, 2, 3, function(err, data, data2) {
	// You got it
});
```

### Promise style

Before:

```javascript
function dummy(a, b, c) {
	return new Promise(function(resolve, reject) {
		// Do complex stuff here
		resolve('A');
	});
};

dummy(1, 2, 3).then(function(data) {
	// You got it
});
```

Adding cache:

```javascript
var dummy = cacheFactory.create(cacheFactory.PROMISE, cacheFactory.ONE_HOUR, function (a, b, c) {
	return new Promise(function(resolve, reject) {
		// Do complex stuff here
		resolve('A');
	});
});

dummy(1, 2, 3).then(function(data) {
	// You got it
});
```

### Fetch when needed (callback style)

```javascript
var users = cacheFactory.create(cacheFactory.ONE_HOUR, function (id, callback) {
	// Do complex stuff here
	callback(undefined, user);
});

users.get(1, function(err, user) {
	// You got it
});
```

### Fetch when needed (promise style)

```javascript
var users = cacheFactory.create(cacheFactory.PROMISE, cacheFactory.ONE_HOUR, function (id) {
	return new Promise(function(resolve, reject) {
		// Do complex stuff here
		resolve(user);
	});
});

users.get(1).then(function(user) {
	// You got it
});
```

### Mixed

```javascript
var users = cacheFactory.create(cacheFactory.ONE_HOUR, function (id, callback) {
	// Do complex stuff here
	callback(undefined, user);
});

users(1, function(err, user) {
	// You got it
});

users.get(1, function(err, user) {
	// You got it
});

users.getAsPromise(1).then(function(user) {
	// You got it
});

var user = users.get(1); // Returns only if cached

user = users(1); // Returns only if cached
```


### Complex

```javascript
var users = cacheFactory.create(cacheFactory.ONE_HOUR, function (id1, id2, callback) {
	// Do complex stuff here
	callback(undefined, user, date);
});

users.get(1, 2, function(err, user, date) {
	// You got it
});

var user = users.get(1, 2); // Returns the user only if cached

users.put(1, 2, user); // Adds the user, but no date

```

	
## API

All arguments passed to the get / put must be JSON serializable.

### cacheFactory.create({ type: string, maxAliveTimeMS: number, maxNotAccessedTimeMs: number, onErrorMaxAliveTimeMs: number }, fetcher: function)

Creates a new cache. 

This is the base constructor, all the other ones are shortcuts to this.

Params:
- An object with the cache configuration. The available fields are:
	- type : one of cacheFactory.CALLBACK or cacheFactory.PROMISE. The default is CALLBACK.
	- maxAliveTimeMS : Max time a value will stay in cache starting with its creation. The default is forever.
	- maxNotAccessedTimeMs : Max time a value will stay in cache after its last access. The default is to only consider alive time.
	- onErrorMaxAliveTimeMs : Max time a value will stay in cache when an error is returned. The default is the same as maxAliveTimeMS.
- fetcher : callback to fetch the data

### cacheFactory.create(type: string, maxAliveTimeMS: number, maxNotAccessedTimeMs: number, fetcher: function)

Creates a new cache. 

Params:
- type : one of cacheFactory.CALLBACK or cacheFactory.PROMISE
- maxAliveTimeMS : Max time a value will stay in cache starting with its creation
- maxNotAccessedTimeMs : Max time a value will stay in cache after its last access
- fetcher : callback to fetch the data

### cacheFactory.create(maxAliveTimeMS: number, maxNotAccessedTimeMs: number, fetcher: function)

Creates a new cache. Fetcher expects a callback.

Params:
- maxAliveTimeMS : Max time a value will stay in cache starting with its creation
- maxNotAccessedTimeMs : Max time a value will stay in cache after its last access
- fetcher : callback to fetch the data

### cacheFactory.create(type: string, maxAliveTimeMS: number, fetcher: function)

Creates a new cache.

Params:
- type : one of cacheFactory.CALLBACK or cacheFactory.PROMISE
- maxAliveTimeMS : Max time a value will stay in cache starting with its creation
- fetcher : callback to fetch the data

### cacheFactory.create(maxAliveTimeMS: number, fetcher: function)

Creates a new cache. Fetcher expects a callback.

Params:
- maxAliveTimeMS : Max time a value will stay in cache starting with its creation
- fetcher : callback to fetch the data

### cacheFactory.create(maxAliveTimeMS: number, maxNotAccessedTimeMs: number)

Creates a new cache. All values must be added to cache using put.

Params:
- maxAliveTimeMS : Max time a value will stay in cache starting with its creation
- maxNotAccessedTimeMs : Max time a value will stay in cache after its last access

### cacheFactory.create(fetcher: function)

Creates a new cache.  Fetcher expects a callback. Values never expires.

Params:
- fetcher : callback to fetch the data

### cacheFactory.create(maxAliveTimeMS: number)

Creates a new cache. All values must be added to cache using put.

Params:
- maxAliveTimeMS : Max time a value will stay in cache starting with its creation

### cacheFactory.create()

Creates a new cache. Values never expires. All values must be added to cache using put.


## License

MIT. Check [LICENSE](https://raw.github.com/pescuma/node-dummy-cache/master/LICENSE) file.
