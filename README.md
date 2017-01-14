# primus-rooms-redis-adapter

[![Build Status](https://img.shields.io/travis/fadeenk/primus-rooms-redis-adapter/master.svg)](https://travis-ci.org/fadeenk/primus-rooms-redis-adapter)
[![NPM version](https://img.shields.io/npm/v/primus-rooms-redis-adapter.svg)](https://www.npmjs.com/package/primus-rooms-redis-adapter)
[![dependencies Status](https://david-dm.org/fadeenk/primus-rooms-redis-adapter/status.svg)](https://david-dm.org/fadeenk/primus-rooms-redis-adapter)

Redis adapter for [primus-rooms](https://github.com/cayasso/primus-rooms). 
Provides integration with [metroplex](https://github.com/primus/metroplex) and [omega-supreme](https://github.com/primus/omega-supreme) to allow for multiple servers support.

## Installation

```
$ npm install primus-rooms-redis-adapter --save
```

## Getting started

The adapter relies on [ioredis](https://github.com/luin/ioredis) for the redis connection, if an incorrect instance is provided the adapter will throw an error

```javascript
'use strict';

var Primus = require('primus');
var Redis = require('ioredis');
var Adapter = require('primus-rooms-redis-adapter');

var redis = new Redis(/* options */);
var adapter = new Adapter(redis, {/* options */});
```

Once the adapter has been initialized it can be used to initialize the `primus-rooms` plugin. 
```javascript
// as an argument 
var primus = new Primus(http, {
  transformer: 'websockets',
  rooms: {adapter: adapter},
  plugin: {
    'rooms': require('primus-rooms'),
  },
});

// or by setting the property
primus.adapter = new Adapter();
```

## Metroplex and Omega-Supreme Integration
If you are using [`metroplex`](https://github.com/primus/metroplex) and [`omega-supreme`](https://github.com/primus/omega-supreme)
plugins, you can use the config function to allow the adapter to handle the broadcasting, removing and other things
related to the multiple servers setup.

### Example Metroplex and Omega-Supreme configuration

```javascript
var options = {
  metroplexOmegaSupreme: true,
  primus: primus,
};

adapter.config(options, function(){
  console.log('clean exit');
});
// or 
primus.adapter.config(options);
```

## API

### new Adapter(redis, [options])
The constructor allows you to initialize the adapter. It requires an ioredis instance connected to a redis db.

The following (optional) options can be provided:

Name                   | Type     | Description                               | Default
-----------------------|----------|-------------------------------------------|---------------
namespace              | String   | namespace to use in redis storage         | `bumblebee`
metroplexOmegaSupreme  | Boolean  | Use `omega-supreme` to broadcast to all servers through `metroplex` | `false`


### adapter.config([options], [cb])
Function to configure the adapter, allows for setting flags as well as enabling clean exit logic on app termination.
To add the listeners for cleanExit a primus instance must be passed in.

**Note**: Preforming cleanExit can take a while especially if the http server timeout is set too high.
The reason for that is due to node design, see [issue #2642](https://github.com/nodejs/node/issues/2642).
I recommend setting http server timeout to based on the server load higher load longer time to finish up
 sending data to the user. To set the time out use `require('http').createServer().setTimeout(x);` where x
 is the timeout duration you want to allow a keep-alive request to be in idle before terminating it.

Name                   | Type     |Description                                | Default
-----------------------|----------|-------------------------------------------|---------------
metroplexOmegaSupreme  | Boolean  | Use `omega-supreme` to broadcast to all servers through `metroplex` | `initilized value`
primus                 | Object   | Primus instance to be used to preform clean exit| `undefined`
cb                     | Function | Callback function after a clean exit is preformed | `undefined`

