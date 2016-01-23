// Copyright (c) 2011 Andrew Paprocki

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var dgram = require('dgram');
var parser = require('./parser');
var protocol = require('./protocol');

function Client(options) {
    if (options) {
        if (typeof(options) !== 'object')
            throw new TypeError('options must be an object');
    } else {
        options = {};
    }

    var self = this;
    EventEmitter.call(this, options);

    this.client = dgram.createSocket('udp4');
    this.client.on('message', function(msg) {
        var pkt = parser.parse(msg);
        switch (pkt.options.dhcpMessageType.value) {
            case protocol.DHCPMessageType.DHCPOFFER.value:
                self.emit('dhcpOffer', pkt);
                break;
            case protocol.DHCPMessageType.DHCPACK.value:
                self.emit('dhcpAck', pkt);
                break;
            case protocol.DHCPMessageType.DHCPNAK.value:
                self.emit('dhcpNak', pkt);
                break;
        default:
        assert(!'Client: received unhandled DHCPMessageType ' +
               pkt.options.dhcpMessageType.value);
        }
    });
    this.client.on('listening', function() {
        var address = self.client.address();
        self.emit('listening', address.address + ':' + address.port);
    });
}
util.inherits(Client, EventEmitter);
module.exports = Client;

Client.prototype.bind = function(host, port, cb) {
    var that = this;
    if (!port) port = 68;
    this.client.bind(port, host, function() {
        that.client.setBroadcast(true);
        if (cb && cb instanceof Function) {
            process.nextTick(cb);
        }
    });
}

Client.prototype.broadcastPacket = function(pkt, options, cb) {
    var port = 67;
    var host = '255.255.255.255';
    if (options) {
        if ('port' in options) port = options.port;
        if ('host' in options) host = options.host;
    }
    this.client.send(pkt, 0, pkt.length, port, host, cb);
}

Client.prototype.sendPacket = function(pkt, host , options, cb) {
    var port = 67;
    if (options) {
        if ('port' in options) port = options.port;
    }
    this.client.send(pkt, 0, pkt.length, port, host, cb);
}

Client.prototype.createDiscoverPacket = function(user) {
    var pkt = {
        op:     0x01,
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
    if ('options' in user) pkt.options = user.options;
    return protocol.createPacket(pkt);
}
