// Copyright (c) 2011 Andrew Paprocki
var V4Address = require('ip-address').Address4;

var createEnum = function(v, n) {
    function Enum(value, name) {
        this.value = value;
        this.name = name;
    }
    Enum.prototype.toString = function() { return this.name; };
    Enum.prototype.valueOf = function() { return this.value; };
    return Object.freeze(new Enum(v, n));
}

var createHardwareAddress = function(t, a) {
    return Object.freeze({ type: t, address: a });
}

var createPacket = function(pkt) {
    if (!('xid' in pkt))
        throw new Error('pkt.xid required');

    var ci = new Buffer(('ciaddr' in pkt) ?
        new V4Address(pkt.ciaddr).toArray() : [0, 0, 0, 0]);
    var yi = new Buffer(('yiaddr' in pkt) ?
        new V4Address(pkt.yiaddr).toArray() : [0, 0, 0, 0]);
    var si = new Buffer(('siaddr' in pkt) ?
        new V4Address(pkt.siaddr).toArray() : [0, 0, 0, 0]);
    var gi = new Buffer(('giaddr' in pkt) ?
        new V4Address(pkt.giaddr).toArray() : [0, 0, 0, 0]);

    if (!('chaddr' in pkt))
        throw new Error('pkt.chaddr required');
    var hw = new Buffer(pkt.chaddr.split(':').map(function(part) {
        return parseInt(part, 16);
    }));
    if (hw.length !== 6)
        throw new Error('pkt.chaddr malformed, only ' + hw.length + ' bytes');

    var p = new Buffer(1500);
    var i = 0;

    p.writeUInt8(pkt.op,    i++);
    p.writeUInt8(pkt.htype, i++);
    p.writeUInt8(pkt.hlen,  i++);
    p.writeUInt8(pkt.hops,  i++);
    p.writeUInt32BE(pkt.xid,   i); i += 4;
    p.writeUInt16BE(pkt.secs,  i); i += 2;
    p.writeUInt16BE(pkt.flags, i); i += 2;
    ci.copy(p, i); i += ci.length;
    yi.copy(p, i); i += yi.length;
    si.copy(p, i); i += si.length;
    gi.copy(p, i); i += gi.length;
    hw.copy(p, i); i += hw.length;
    p.fill(0, i, i + 10); i += 10; // hw address padding
    p.fill(0, i, i + 192); i += 192;
    p.writeUInt32BE(0x63825363, i); i += 4;

    if (pkt.options && 'requestedIpAddress' in pkt.options) {
        p.writeUInt8(50, i++); // option 50
        var requestedIpAddress = new Buffer(
            new V4Address(pkt.options.requestedIpAddress).toArray());
        p.writeUInt8(requestedIpAddress.length, i++);
        requestedIpAddress.copy(p, i); i += requestedIpAddress.length;
    }
    if (pkt.options && 'dhcpMessageType' in pkt.options) {
        p.writeUInt8(53, i++); // option 53
        p.writeUInt8(1, i++);  // length
        p.writeUInt8(pkt.options.dhcpMessageType.value, i++);
    }
    if (pkt.options && 'serverIdentifier' in pkt.options) {
        p.writeUInt8(54, i++); // option 54
        var serverIdentifier = new Buffer(
            new V4Address(pkt.options.serverIdentifier).toArray());
        p.writeUInt8(serverIdentifier.length, i++);
        serverIdentifier.copy(p, i); i += serverIdentifier.length;
    }
    if (pkt.options && 'parameterRequestList' in pkt.options) {
        p.writeUInt8(55, i++); // option 55
        var parameterRequestList = new Buffer(pkt.options.parameterRequestList);
        if (parameterRequestList.length > 16)
            throw new Error('pkt.options.parameterRequestList malformed');
        p.writeUInt8(parameterRequestList.length, i++);
        parameterRequestList.copy(p, i); i += parameterRequestList.length;
    }
    if (pkt.options && 'clientIdentifier' in pkt.options) {
        var clientIdentifier = new Buffer(pkt.options.clientIdentifier);
        var optionLength = 1 + clientIdentifier.length;
        if (optionLength > 0xff)
            throw new Error('pkt.options.clientIdentifier malformed');
        p.writeUInt8(61, i++);           // option 61
        p.writeUInt8(optionLength, i++); // length
        p.writeUInt8(0, i++);            // hardware type 0
        clientIdentifier.copy(p, i); i += clientIdentifier.length;
    }

    // option 255 - end
    p.writeUInt8(0xff, i++);

    // padding
    if ((i % 2) > 0) {
        p.writeUInt8(0, i++);
    } else {
        p.writeUInt16BE(0, i++);
    }

    var remaining = 300 - i;
    if (remaining) {
        p.fill(0, i, i + remaining); i+= remaining;
    }

    //console.log('createPacket:', i, 'bytes');
    return p.slice(0, i);
}

module.exports = {
    createPacket: createPacket,

    createHardwareAddress: createHardwareAddress,

    BOOTPMessageType: Object.freeze({
        BOOTPREQUEST: createEnum(1, 'BOOTPREQUEST'),
        BOOTPREPLY: createEnum(2, 'BOOTPREPLY'),
        get: function(value) {
            for (key in this) {
                var obj = this[key];
                if (obj == value)
                    return obj;
            }
            return undefined;
        }
    }),

    // rfc1700 hardware types
    ARPHardwareType: Object.freeze({
        HW_ETHERNET: createEnum(1, 'HW_ETHERNET'),
        HW_EXPERIMENTAL_ETHERNET: createEnum(2, 'HW_EXPERIMENTAL_ETHERNET'),
        HW_AMATEUR_RADIO_AX_25: createEnum(3, 'HW_AMATEUR_RADIO_AX_25'),
        HW_PROTEON_TOKEN_RING: createEnum(4, 'HW_PROTEON_TOKEN_RING'),
        HW_CHAOS: createEnum(5, 'HW_CHAOS'),
        HW_IEEE_802_NETWORKS: createEnum(6, 'HW_IEEE_802_NETWORKS'),
        HW_ARCNET: createEnum(7, 'HW_ARCNET'),
        HW_HYPERCHANNEL: createEnum(8, 'HW_HYPERCHANNEL'),
        HW_LANSTAR: createEnum(9, 'HW_LANSTAR'),
        get: function(value) {
            for (key in this) {
                var obj = this[key];
                if (obj == value)
                    return obj;
            }
            return undefined;
        }
    }),

    // rfc1533 code 53 dhcpMessageType
    DHCPMessageType: Object.freeze({
        DHCPDISCOVER: createEnum(1, 'DHCPDISCOVER'),
        DHCPOFFER: createEnum(2, 'DHCPOFFER'),
        DHCPREQUEST: createEnum(3, 'DHCPREQUEST'),
        DHCPDECLINE: createEnum(4, 'DHCPDECLINE'),
        DHCPACK: createEnum(5, 'DHCPACK'),
        DHCPNAK: createEnum(6, 'DHCPNAK'),
        DHCPRELEASE: createEnum(7, 'DHCPRELEASE'),
        get: function(value) {
            for (key in this) {
                var obj = this[key];
                if (obj == value)
                    return obj;
            }
            return undefined;
        }
    })
}
