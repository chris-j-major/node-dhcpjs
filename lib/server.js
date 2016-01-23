// Copyright (c) 2011 Andrew Paprocki

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var dgram = require('dgram');
var parser = require('./parser');
var protocol = require('./protocol');

function Server(options) {
    if (options) {
        if (typeof(options) !== 'object')
            throw new TypeError('Server options must be an object');
    } else {
        options = {};
    }

    var self = this;
    EventEmitter.call(this, options);

    this.server = dgram.createSocket('udp4');
    this.server.on('message', function(msg, rinfo) {
      var pkt = parser.parse(msg);
      switch (pkt.options.dhcpMessageType.value) {
          case protocol.DHCPMessageType.DHCPDISCOVER.value:
              self.emit('dhcpDiscover', pkt);
              break;
          case protocol.DHCPMessageType.DHCPREQUEST.value:
              self.emit('dhcpRequest', pkt);
              break;
          case protocol.DHCPMessageType.DHCPDECLINE.value:
              self.emit('dhcpDecline', pkt);
              break;
          case protocol.DHCPMessageType.DHCPRELEASE.value:
              self.emit('dhcpRelease', pkt);
              break;
      default:
        self.emit('unhandledDHCPMessageType',pkt);
      }
    });
    this.server.on('listening', function() {
        var address = self.server.address();
        self.emit('listening', address.address + ':' + address.port);
    });
}
util.inherits(Server, EventEmitter);
module.exports = Server;

Server.prototype.bind = function(host,port) {
    var _this = this;
    if (!port) port = 67;
    this.server.bind(port, host, function() {
    	_this.server.setBroadcast(true);
    });
}

Server.prototype.broadcastPacket = function(pkt, options, cb) {
    var port = 68;
    var host = '255.255.255.255';
    if (options) {
        if ('port' in options) port = options.port;
        if ('host' in options) host = options.host;
    }
    this.server.send(pkt, 0, pkt.length, port, host, cb);
}

Server.prototype.sendPacket = function(pkt, host , options, cb) {
    var port = 68;
    if (options) {
        if ('port' in options) port = options.port;
    }
    this.server.send(pkt, 0, pkt.length, port, host, cb);
}

Server.prototype.createOfferPacket = function(user) {
    var pkt = {
        op:     protocol.DHCPMessageType.DHCPOFFER.value,
        htype:  0x01,
        hlen:   0x06,
        hops:   0x00,
        xid:    0x00000000,
        secs:   0x0000,
        flags:  0x0000,
        ciaddr: '0.0.0.0',
        yiaddr: '0.0.0.0',
        siaddr: '0.0.0.0',
        giaddr: '0.0.0.0',
    };
    if ('xid' in user) pkt.xid = user.xid;
    if ('chaddr' in user) pkt.chaddr = user.chaddr;
    if ('yiaddr' in user) pkt.yiaddr = user.yiaddr;
    if ('options' in user) pkt.options = user.options;
    return protocol.createPacket(pkt);
}
