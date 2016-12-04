'use strict';

var Adapter = require('../');
var Redis = require('ioredis');
var expect = require('expect.js');

describe('primus-rooms-adapter', function() {
  var redis = new Redis();
  it('should have required methods', function() {
    var adapter = new Adapter(redis);
    expect(adapter.set).to.be.a('function');
    expect(adapter.get).to.be.a('function');
    expect(adapter.del).to.be.a('function');
    expect(adapter.broadcast).to.be.a('function');
    expect(adapter.clients).to.be.a('function');
    expect(adapter.empty).to.be.a('function');
    expect(adapter.isEmpty).to.be.a('function');
    expect(adapter.clear).to.be.a('function');
    expect(adapter.config).to.be.a('function');
    expect(adapter.wildcard).to.be.an('object');
  });

  it('initialized correctly', function() {
    var adapter = new Adapter(redis, {metroplex: true});
    expect(adapter.rooms).to.be(undefined);
    expect(adapter.sids).to.be(undefined);
    expect(adapter.namespace).to.be('bumblebee:');
    expect(adapter.omegaSupreme).to.be(false);
    expect(adapter.metroplex).to.be(true);
    expect(adapter.redis).to.be.an('object');
  });

  it('configure correctly', function() {
    var adapter = new Adapter(redis);
    expect(adapter.omegaSupreme).to.be(false);
    expect(adapter.metroplex).to.be(false);
    adapter.config({
      omegaSupreme: true,
      metroplex: true,
      getClients: function() {
        return Object.keys(primus.connections);
      },
    });
    expect(adapter.omegaSupreme).to.be(true);
    expect(adapter.metroplex).to.be(true);
    expect(adapter.redis).to.be.an('object');
    expect(adapter.getClients).to.be.a('function');
  });
});
