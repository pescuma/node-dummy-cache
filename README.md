node-dummy-cache
================

A simple in memory cache to use with nodejs.


## Installation

	npm install node-dummy-cache


## Usage

### Simple key/value

```javascript
var cache = require('node-dummy-cache');

var users = cache.create(cache.ONE_HOUR);

users.put(1, { name : 'A' });

var user = users.get(1);
```

### Fetch when needed

```javascript
var cache = require('node-dummy-cache');

var users = cache.create(cache.ONE_HOUR, function (id, callback) {
	// Do complex stuff here
	callback(undefined, user);
});

users.get(1, function(err, user) {
	// You got it
});
```

### Mixed

```javascript
var cache = require('node-dummy-cache');

var users = cache.create(cache.ONE_HOUR, function (id, callback) {
	// Do complex stuff here
	callback(undefined, user);
});

users.get(1, function(err, user) {
	// You got it
});

var user = users.get(1); // Returns only if cached
```

	