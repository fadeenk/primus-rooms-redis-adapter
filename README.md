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

// by setting the property
primus.adapter = new Adapter();
```

## Metroplex and Omega-Supreme Integration
If you are using [`metroplex`](https://github.com/primus/metroplex) and [`omega-supreme`](https://github.com/primus/omega-supreme)
plugins, you can use the config function to allow the adapter to handle the broadcasting, removing and other things
related to the multiple servers setup.

### Example Metroplex and Omega-Supreme configuration

```javascript
var options = {
  omegaSupreme: true,
  metroplex: true,
  getClients: function() {
    return Object.keys(primus.connections);
  },
  addRemoveClientsOnExit: true,
};

adapter.config(options);
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
omegaSupreme           | Boolean  | Use `omega-supreme`                       | `false`
metroplex              | Boolean  | Use `metroplex`                           | `false`
addRemoveClientsOnExit | Boolean  | Adds listeners to remove clients on exit  | `false`


### adapter.config([options])
Function to configure the adapter for metro

Name                   | Type     |Description                                | Default
-----------------------|----------|-------------------------------------------|---------------
omegaSupreme           | Boolean  | Use `omega-supreme`                       | `initilized value`
metroplex              | Boolean  | Use `metroplex`                           | `initilized value`
addRemoveClientsOnExit | Boolean  | Adds listeners to remove clients on exit  | `false`
getClients             | Function | Get clients connected to this server      | `undefined`

