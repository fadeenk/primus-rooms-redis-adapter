'use strict';

var util = require('util');
var Adapter = require('primus-rooms-adapter');
var fs = require('fs');
var path = require('path');
var Redis = require('ioredis');

module.exports = redisAdapter;

/**
 * Creates redis adapter instance
 * @constructor
 * @param {Redis} redis - ioredis instance
 * @param {Object} [opts] - options passed in
 * @param {String} [opts.namespace='bumblebee'] - namespace to use when saving to redis
 * @param {Boolean} [opts.omegaSupreme=false] - boolean for omegaSupreme plugin is being used
 * @param {Boolean} [opts.metroplex=false] - boolean for metroplex plugin is being used
 */
function redisAdapter(redis, opts) {
  if (redis instanceof Redis) {
    this.redis = redis;
  } else {
    throw new Error('redis object is not an instance of ioredis');
  }
  var lua = fs.readFileSync(path.join(__dirname, 'removeRooms.lua'), 'utf8');
  opts = opts || {};
  /* eslint-disable no-invalid-this */
  this.namespace = opts.namespace === undefined ? 'bumblebee:' : opts.namespace + ':';
  this.omegaSupreme = opts.omegaSupreme === undefined ? false : opts.omegaSupreme;
  this.metroplex = opts.metroplex === undefined ? false : opts.metroplex;
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
 * Configuration function to add custom function for getting clients as well as change omegaSupreme and metroplex flags
 * @param {Object} [opts] - options passed in
 * @param {Function} [opts.getClients] - function used to get this servers connected clients
 * @param {Boolean} [opts.omegaSupreme=false] - boolean for omegaSupreme plugin is being used
 * @param {Boolean} [opts.metroplex=false] - boolean for metroplex plugin is being used
 */
redisAdapter.prototype.config = function config(opts) {
  opts = opts || {};
  this.omegaSupreme = opts.omegaSupreme === undefined ? this.omegaSupreme : opts.omegaSupreme;
  this.metroplex = opts.metroplex === undefined ? this.metroplex : opts.metroplex;
  this.addRemoveClientsOnExit = opts.addRemoveClientsOnExit === true;
  if (typeof opts.getClients === 'function') {
    this.getClients = opts.getClients;
    var lua = fs.readFileSync(path.join(__dirname, 'removeClients.lua'), 'utf8');
    this.redis.defineCommand('removeClients', {
      lua: lua.replace('bumblebee', this.namespace),
      numberOfKeys: 1,
    });
    if (this.addRemoveClientsOnExit) {
      this.addRemoveClientsListners();
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
    if (adapter.omegaSupreme && adapter.metroplex) {
      var primus = clients[Object.keys(clients)[0]].primus;
      primus.forward.sparks(ids, transformer(data));
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
redisAdapter.prototype.removeClients = function(fn) {
  if (typeof this.redis.removeClients === 'function') {
    var commands = [];
    var clients = this.getClients();
    clients.forEach(function(id) {
      commands.push(['removeClients', id]);
    });
    this.redis.multi(commands).exec(function(err, res) {
      if (fn) {
        process.nextTick(fn.bind(null, err, res));
      }
    });
  } else {
    this.clear(fn);
  }
};

/**
 * Adds listners to handle node process exiting and ensure that the sockets connected to this server are removed from
 * the redis
 */
redisAdapter.prototype.addRemoveClientsListners = function() {
  var adapter = this;
  var signals = ['exit', 'SIGINT', 'SIGTERM', 'SIGQUIT', 'uncaughtException'];
  signals.forEach(function(sig) {
    process.on(sig, function(e) {
      adapter.removeClients();
    });
  });
};
