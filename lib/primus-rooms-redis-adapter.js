'use strict';

var util = require('util');
var Adapter = require('primus-rooms-adapter');
var fs = require('fs');
var path = require('path');
var Redis = require('ioredis');
var Primus = require('primus');

module.exports = redisAdapter;

/**
 * Creates redis adapter instance
 * @constructor
 * @param {Redis} redis - ioredis instance
 * @param {Object} [opts] - options passed in
 * @param {String} [opts.namespace='bumblebee'] - namespace to use when saving to redis
 * @param {Boolean} [opts.metroplexOmegaSupreme=false] - boolean for omegaSupreme and metroplex plugins are being used
 */
function redisAdapter(redis, opts) {
  /* eslint-disable no-invalid-this */
  if (redis instanceof Redis) {
    this.redis = redis;
  } else {
    throw new Error('redis object is not an instance of ioredis');
  }
  var lua = fs.readFileSync(path.join(__dirname, 'removeRooms.lua'), 'utf8');
  opts = opts || {};
  this.listenersAdded = false;
  this.namespace = opts.namespace === undefined ? 'bumblebee:' : opts.namespace + ':';
  this.metroplexOmegaSupreme = opts.metroplexOmegaSupreme === undefined ? false : opts.metroplexOmegaSupreme;
  this.redis.defineCommand('removeRooms', {
    lua: lua.replace('bumblebee', this.namespace),
    numberOfKeys: 1,
  });
  Adapter.call(this);
  delete this.rooms;
  delete this.sids;
  /* eslint-enable no-invalid-this */
}

util.inherits(redisAdapter, Adapter);

/**
 * Configuration function to set metroplexOmegaSupreme flag and expose primus instance to the adapter
 * @param {Object} [opts] - options passed in
 * @param {Function} [cb] - callback function for cleanExit, only used when primus instance is exposed through options
 * @param {Object} [opts.primus] - primus instance used to preform clean exit on app termination
 * @param {Boolean} [opts.metroplexOmegaSupreme=false] - boolean for omegaSupreme and metroplex plugins are being used
 */
redisAdapter.prototype.config = function config(opts, cb) {
  opts = opts || {};
  this.metroplexOmegaSupreme = opts.metroplexOmegaSupreme === undefined ? false : opts.metroplexOmegaSupreme;
  this.hasPrimus = opts.primus instanceof Primus;
  if (this.hasPrimus) {
    this.primus = opts.primus;
    if (!this.listenersAdded) {
      if (typeof cb === 'function') {
        this.addCleanExitListeners(cb);
      } else {
        this.addCleanExitListeners();
      }
      this.listenersAdded = true;
    }
  }
};

/**
 * Adds a socket to a room
 * @param {String} id - Socket id
 * @param {String} room - Room name
 * @param {Function} [fn] - Callback
 */
redisAdapter.prototype.add = redisAdapter.prototype.set = function set(id, room, fn) {
  this.redis.multi()
    .sadd(this.namespace + 'sparks:' + id, room)
    .sadd(this.namespace + 'rooms:' + room, id)
    .exec(function(err, res) {
      if (fn) {
        process.nextTick(fn.bind(null, err, res));
      }
    });
};

/**
 * Get rooms the socket is in or get all rooms if no socket ID is provided
 * returns Array of room names
 * @param {String} [id] Socket id
 * @param {Function} [fn] Callback
 */
redisAdapter.prototype.get = function get(id, fn) {
  var adapter = this;
  if (id) {
    adapter.redis.smembers(adapter.namespace + 'sparks:' + id).then(function(rooms) {
      if (fn) {
        process.nextTick(fn.bind(null, null, rooms));
      }
    });
  } else {
    adapter.redis.keys(adapter.namespace + 'rooms:*').then(function(rooms) {
      for (var i = 0; i < rooms.length; i++) {
        rooms[i] = rooms[i].substring(adapter.namespace.length + 'rooms:'.length);
      }
      if (fn) {
        process.nextTick(fn.bind(null, null, rooms));
      }
    });
  }
};

/**
 * Remove a socket from a room or all rooms if a room name is not passed.
 * @param {String} id - Socket id
 * @param {String} [room] - Room name
 * @param {Function} [fn] Callback
 */
redisAdapter.prototype.del = function del(id, room, fn) {
  var adapter = this;
  if (room && room.length > 0) {
    remove([room]);
  } else {
    this.redis.smembers(this.namespace + 'sparks:' + id)
      .then(function(rooms) {
        remove(rooms);
      });
  }

  /**
   * Logic to remove the socket from the rooms passed in
   * @param {Array} rooms - rooms to remove the socket from
   */
  function remove(rooms) {
    var commands = [];
    if (rooms.length > 0) {
      commands.push(['srem', adapter.namespace + 'sparks:' + id].concat(rooms));
    }
    rooms.forEach(function(room) {
      commands.push(['srem', adapter.namespace + 'rooms:' + room, id]);
    });
    adapter.redis.multi(commands).exec(function(err, res) {
      if (fn) {
        process.nextTick(fn.bind(null, err, res));
      }
    });
  }
};

/**
 * Broadcast a packet.
 * @param {*} data - Data to broadcast
 * @param {Object} [opts] - Broadcast options
 * @param {Array} [opts.except=[]] - Socket ids to exclude
 * @param {Array} [opts.rooms=[]] - List of rooms to broadcast to
 * @param {String} [opts.method='write'] - 'write' or 'send' if primus-emitter is present
 * @param {Function} [opts.transformer] - Message transformer
 * @param {Object} clients - Connected clients
 */
redisAdapter.prototype.broadcast = function broadcast(data, opts, clients) {
  var adapter = this;
  opts = opts || {};

  var rooms = opts.rooms || [];
  var except = opts.except || [];
  var method = opts.method || 'write';
  var transformer = opts.transformer || function(dataToTransform) {
    return dataToTransform[0];
  };
  var length = rooms.length;

  if (length === 0) {
    adapter.redis.keys(adapter.namespace + 'sparks:*').then(function(ids) {
      for (var i = 0; i < ids.length; i++) {
        ids[i] = ids[i].substring(adapter.namespace.length + 'sparks:'.length);
      }
      send(ids);
    }).catch(function(err) {
      console.error(err);
    });
  } else {
    var commands = [];
    rooms.forEach(function(room) {
      commands.push(['smembers', adapter.namespace + 'rooms:' + room]);
    });
    this.redis.multi(commands).exec(function(err, res) {
      var ids = new Set();
      res.forEach(function(response) {
        response[1].forEach(function(id) {
          ids.add(id);
        });
      });
      send(Array.from(ids));
    });
  }

  /**
   * Logic responsible for sending the data passed in to the sparks specifed in the ids array
   * @param {Array} ids - spark ids to broadcast the data to
   */
  function send(ids) {
    ids = ids.filter(function(id) {
      return ~except.indexOf(id) === 0;
    });
    if (adapter.metroplexOmegaSupreme) {
      var clientsKeys = Object.keys(clients);
      if (clientsKeys.length) {
        var primus = clients[clientsKeys[0]].primus;
        primus.forward.sparks(ids, transformer(data));
      }
    } else {
      ids.forEach(function(id) {
        var socket = clients[id];
        if (socket) {
          adapter.transform(socket, data, method, transformer);
        }
      });
    }
  }
};

/**
 * Get client ids connected to a room.
 * returns Array of spark ids
 * @param {String} room - Room name
 * @param {Function} [fn] - Callback
 */
redisAdapter.prototype.clients = function clients(room, fn) {
  this.redis.smembers(this.namespace + 'rooms:' + room).then(function(ids) {
    if (fn) {
      process.nextTick(fn.bind(null, null, ids));
    }
  });
};

/**
 * Remove all sockets from a room.
 * @param {String|Array} room - Room name
 * @param {Function} [fn] - Callback
 */
redisAdapter.prototype.empty = function empty(room, fn) {
  var rooms = room;
  if (typeof room === 'string') {
    rooms = [room];
  }
  var commands = [];
  rooms.forEach(function(room) {
    commands.push(['removeRooms', room]);
  });
  this.redis.multi(commands).exec(function(err, res) {
    if (fn) {
      process.nextTick(fn.bind(null, err, res));
    }
  });
};

/**
 * Check if a room is empty.
 * returns `true` if the room is empty, else `false`
 * @param {String} room - Room name
 * @param {Function} [fn] - Callback
 */
redisAdapter.prototype.isEmpty = function isEmpty(room, fn) {
  this.redis.scard(this.namespace + 'rooms:' + room).then(function(count) {
    if (fn) {
      process.nextTick(fn.bind(null, null, !count));
    }
  });
};

/**
 * Reset the store. Will remove everything including all socket data from other adapter in the same cluster
 * @param {Function} [fn] - Callback
 */
redisAdapter.prototype.clear = function clear(fn) {
  var adapter = this;
  adapter.redis.keys(this.namespace + '*').then(function(keys) {
    adapter.redis.del(keys, function(err, res) {
      if (fn) {
        process.nextTick(fn.bind(null, err, res));
      }
    });
  });
};

/**
 * Removes all clients connected to the current server from redis
 * (Does not affect other clients connected to the same redis from other servers in the cluster)
 * @param {Function} [fn] - Callback
 */
redisAdapter.prototype.cleanExit = function(fn) {
  var redis = this.redis;
  var primus = this.primus;
  primus.destroy(function() {
    redis.quit(function(err, res) {
      if (fn) {
        process.nextTick(fn.bind(null, err, res));
      }
    });
  });
};

/**
 * Adds listeners to handle node process exiting and ensure that the sockets connected to this server are removed from
 * the redis
 * @param {Function} cb - callback function to bass to the cleanExit function
 */
redisAdapter.prototype.addCleanExitListeners = function(cb) {
  var adapter = this;
  var signals = ['SIGINT', 'SIGTERM', 'SIGQUIT', 'uncaughtException'];
  signals.forEach(function(sig) {
    process.on(sig, function redisAdapterCleanExit() {
      adapter.cleanExit(cb);
    });
  });
};
