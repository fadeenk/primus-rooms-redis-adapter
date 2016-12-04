'use strict';

var Adapter = require('../');
var expect = require('expect.js');

describe('primus-rooms-adapter', function() {
  it('should have required methods', function() {
    var adapter = new Adapter();
    expect(adapter.set).to.be.a('function');
    expect(adapter.get).to.be.a('function');
    expect(adapter.del).to.be.a('function');
    expect(adapter.broadcast).to.be.a('function');
    expect(adapter.clients).to.be.a('function');
    expect(adapter.empty).to.be.a('function');
    expect(adapter.isEmpty).to.be.a('function');
    expect(adapter.clear).to.be.a('function');
    expect(adapter.wildcard).to.be.an('object');
  });

  it('initialized correctly', function() {
    var adapter = new Adapter({metroplex: true});
    expect(adapter.rooms).to.be(undefined);
    expect(adapter.sids).to.be(undefined);
    expect(adapter.namespace).to.be('bumblebee');
    expect(adapter.omegaSupreme).to.be(false);
    expect(adapter.metroplex).to.be(true);
    expect(adapter.redis).to.be.an('object');
  });
});
