/**********************************
SOCKET.JS
***************************/
'use strict';

/**
 * Module dependencies.
 */

var Emitter = require('events').EventEmitter;
var parser = require('socket.io-parser');
var url = require('url');
var debug = require('debug')('socket.io:socket');
var hasBin = require('has-binary');

/**
 * Blacklisted events.
 *
 * @api public
 */

var exportsEvents = [
  'error',
  'connect',
  'disconnect',
  'newListener',
  'removeListener'
];

/**
 * Flags.
 *
 * @api private
 */

var flags = [
  'json',
  'volatile',
  'broadcast'
];

/**
 * `EventEmitter#emit` reference.
 */

var emit = Emitter.prototype.emit;

/**
 * Interface to a `Client` for a given `Namespace`.
 *
 * @param {Namespace} nsp
 * @param {Client} client
 * @api public
 */

class Socket extends Emitter {
  constructor(nsp, client, query){
    super();
    this.nsp = nsp;
    this.server = nsp.server;
    this.adapter = this.nsp.adapter;
    this.id = nsp.name !== '/' ? nsp.name + '#' + client.id : client.id;
    this.client = client;
    this.conn = client.conn;
    this.rooms = {};
    this.acks = {};
    this.connected = true;
    this.disconnected = false;
    this.handshake = this.buildHandshake(query);
  }

  /**
   * Builds the `handshake` BC object
   *
   * @api private
   */

  buildHandshake(query){
    var self = this;
    function buildQuery(){
      var requestQuery = url.parse(self.request.url, true).query;
      //if socket-specific query exist, replace query strings in requestQuery
      if(query){
        query.t = requestQuery.t;
        query.EIO = requestQuery.EIO;
        query.transport = requestQuery.transport;
        return query;
      }
      return requestQuery || {};
    }
    return {
      headers: this.request.headers,
      time: (new Date) + '',
      address: this.conn.remoteAddress,
      xdomain: !!this.request.headers.origin,
      secure: !!this.request.connection.encrypted,
      issued: +(new Date),
      url: this.request.url,
      query: buildQuery()
    };
  }

  /**
   * Emits to this client.
   *
   * @return {Socket} self
   * @api public
   */

  emit(ev){
    if (~exportsEvents.indexOf(ev)) {
      emit.apply(this, arguments);
    } else {
      var args = Array.prototype.slice.call(arguments);
      var packet = {};
      packet.type = hasBin(args) ? parser.BINARY_EVENT : parser.EVENT;
      packet.data = args;
      var flags = this.flags || {};

      // access last argument to see if it's an ACK callback
      if ('function' == typeof args[args.length - 1]) {
        if (this._rooms || flags.broadcast) {
          throw new Error('Callbacks are not supported when broadcasting');
        }

        debug('emitting packet with ack id %d', this.nsp.ids);
        this.acks[this.nsp.ids] = args.pop();
        packet.id = this.nsp.ids++;
      }

      if (this._rooms || flags.broadcast) {
        this.adapter.broadcast(packet, {
          except: [this.id],
          rooms: this._rooms,
          flags: flags
        });
      } else {
        // dispatch packet
        this.packet(packet, {
          volatile: flags.volatile,
          compress: flags.compress
        });
      }

      // reset flags
      delete this._rooms;
      delete this.flags;
    }
    return this;
  }

  /**
   * Targets a room when broadcasting.
   *
   * @param {String} name
   * @return {Socket} self
   * @api public
   */

  in(name){
    this._rooms = this._rooms || [];
    if (!~this._rooms.indexOf(name)) this._rooms.push(name);
    return this;
  }

  /**
   * Sends a `message` event.
   *
   * @return {Socket} self
   * @api public
   */

  send(){
    var args = Array.prototype.slice.call(arguments);
    args.unshift('message');
    this.emit.apply(this, args);
    return this;
  }

  /**
   * Writes a packet.
   *
   * @param {Object} packet object
   * @param {Object} opts options
   * @api private
   */

  packet(packet, opts){
    packet.nsp = this.nsp.name;
    opts = opts || {};
    opts.compress = false !== opts.compress;
    this.client.packet(packet, opts);
  }

  /**
   * Joins a room.
   *
   * @param {String} room
   * @param {Function} fn optional, callback
   * @return {Socket} self
   * @api private
   */

  join(room, fn){
    debug('joining room %s', room);
    var self = this;
    if (this.rooms.hasOwnProperty(room)) {
      fn && fn(null);
      return this;
    }
    this.adapter.add(this.id, room, function(err){
      if (err) return fn && fn(err);
      debug('joined room %s', room);
      self.rooms[room] = room;
      fn && fn(null);
    });
    return this;
  };

  /**
   * Leaves a room.
   *
   * @param {String} room
   * @param {Function} fn optional, callback
   * @return {Socket} self
   * @api private
   */

  leave(room, fn){
    debug('leave room %s', room);
    var self = this;
    this.adapter.del(this.id, room, function(err){
      if (err) return fn && fn(err);
      debug('left room %s', room);
      delete self.rooms[room];
      fn && fn(null);
    });
    return this;
  }

  /**
   * Leave all rooms.
   *
   * @api private
   */

  leaveAll(){
    this.adapter.delAll(this.id);
    this.rooms = {};
  }

  /**
   * Called by `Namespace` upon succesful
   * middleware execution (ie: authorization).
   *
   * @api private
   */

  onconnect(){
    debug('socket connected - writing packet');
    this.nsp.connected[this.id] = this;
    this.join(this.id);
    this.packet({ type: parser.CONNECT });
  }

  /**
   * Called with each packet. Called by `Client`.
   *
   * @param {Object} packet
   * @api private
   */

  onpacket(packet){
    debug('got packet %j', packet);
    switch (packet.type) {
      case parser.EVENT:
        this.onevent(packet);
        break;

      case parser.BINARY_EVENT:
        this.onevent(packet);
        break;

      case parser.ACK:
        this.onack(packet);
        break;

      case parser.BINARY_ACK:
        this.onack(packet);
        break;

      case parser.DISCONNECT:
        this.ondisconnect();
        break;

      case parser.ERROR:
        this.emit('error', packet.data);
    }
  }

  /**
   * Called upon event packet.
   *
   * @param {Object} packet object
   * @api private
   */

  onevent(packet){
    var args = packet.data || [];
    debug('emitting event %j', args);

    if (null != packet.id) {
      debug('attaching ack callback to event');
      args.push(this.ack(packet.id));
    }

    emit.apply(this, args);
  }

  /**
   * Produces an ack callback to emit with an event.
   *
   * @param {Number} id packet id
   * @api private
   */

  ack(id){
    var self = this;
    var sent = false;
    return function(){
      // prevent double callbacks
      if (sent) return;
      var args = Array.prototype.slice.call(arguments);
      debug('sending ack %j', args);

      var type = hasBin(args) ? parser.BINARY_ACK : parser.ACK;
      self.packet({
        id: id,
        type: type,
        data: args
      });

      sent = true;
    };
  }

  /**
   * Called upon ack packet.
   *
   * @api private
   */

  onack(packet){
    var ack = this.acks[packet.id];
    if ('function' == typeof ack) {
      debug('calling ack %s with %j', packet.id, packet.data);
      ack.apply(this, packet.data);
      delete this.acks[packet.id];
    } else {
      debug('bad ack %s', packet.id);
    }
  }

  /**
   * Called upon client disconnect packet.
   *
   * @api private
   */

  ondisconnect(){
    debug('got disconnect packet');
    this.onclose('client namespace disconnect');
  };

  /**
   * Handles a client error.
   *
   * @api private
   */

  onerror(err){
    if (this.listeners('error').length) {
      this.emit('error', err);
    } else {
      console.error('Missing error handler on `socket`.');
      console.error(err.stack);
    }
  }

  /**
   * Called upon closing. Called by `Client`.
   *
   * @param {String} reason
   * @throw {Error} optional error object
   * @api private
   */

  onclose(reason){
    if (!this.connected) return this;
    debug('closing socket - reason %s', reason);
    this.leaveAll();
    this.nsp.remove(this);
    this.client.remove(this);
    this.connected = false;
    this.disconnected = true;
    delete this.nsp.connected[this.id];
    this.emit('disconnect', reason);
  }

  /**
   * Produces an `error` packet.
   *
   * @param {Object} err error object
   * @api private
   */

  error(err){
    this.packet({ type: parser.ERROR, data: err });
  }

  /**
   * Disconnects this client.
   *
   * @param {Boolean} close if `true`, closes the underlying connection
   * @return {Socket} self
   * @api public
   */

  disconnect(close){
    if (!this.connected) return this;
    if (close) {
      this.client.disconnect();
    } else {
      this.packet({ type: parser.DISCONNECT });
      this.onclose('server namespace disconnect');
    }
    return this;
  }

  /**
   * Sets the compress flag.
   *
   * @param {Boolean} compress if `true`, compresses the sending data
   * @return {Socket} self
   * @api public
   */

  compress(compress){
    this.flags = this.flags || {};
    this.flags.compress = compress;
    return this;
  }
  
}

/**
 * Apply flags from `Socket`.
 */

flags.forEach(function(flag){
  Socket.prototype.__defineGetter__(flag, function(){
    this.flags = this.flags || {};
    this.flags[flag] = true;
    return this;
  });
});

/**
 * `request` engine.io shortcut.
 *
 * @api public
 */

Socket.prototype.__defineGetter__('request', function(){
  return this.conn.request;
});

/**
 * Methods sharing functions
 */

Socket.prototype.to = Socket.prototype.in;
Socket.prototype.write = Socket.prototype.send;

/**
 * Module exports.
 */

//module.exports = exports = Socket;


/*******************************
CLIENT.JS
*************************/
//'use strict';

/**
 * Module dependencies.
 */

var parser = require('socket.io-parser');
var debug = require('debug')('socket.io:client');
var url = require('url');

/**
 * Client constructor.
 *
 * @param {Server} server instance
 * @param {Socket} conn
 * @api private
 */

class Client{
  constructor(server, conn){
    this.server = server;
    this.conn = conn;
    this.encoder = new parser.Encoder();
    this.decoder = new parser.Decoder();
    this.id = conn.id;
    this.request = conn.request;
    this.setup();
    this.sockets = {};
    this.nsps = {};
    this.connectBuffer = [];
  }

  /**
   * Sets up event listeners.
   *
   * @api private
   */

  setup(){
    this.onclose = this.onclose.bind(this);
    this.ondata = this.ondata.bind(this);
    this.onerror = this.onerror.bind(this);
    this.ondecoded = this.ondecoded.bind(this);

    this.decoder.on('decoded', this.ondecoded);
    this.conn.on('data', this.ondata);
    this.conn.on('error', this.onerror);
    this.conn.on('close', this.onclose);
  }

  /**
   * Connects a client to a namespace.
   *
   * @param {String} name namespace
   * @api private
   */

  connect(name, query){
    debug('connecting to namespace %s', name);
    var nsp = this.server.nsps[name];
    if (!nsp) {
      this.packet({ type: parser.ERROR, nsp: name, data : 'Invalid namespace'});
      return;
    }

    if ('/' != name && !this.nsps['/']) {
      this.connectBuffer.push(name);
      return;
    }

    var self = this;
    var socket = nsp.add(this, query, function(){
      self.sockets[socket.id] = socket;
      self.nsps[nsp.name] = socket;

      if ('/' == nsp.name && self.connectBuffer.length > 0) {
        self.connectBuffer.forEach(self.connect, self);
        self.connectBuffer = [];
      }
    });
  }

  /**
   * Disconnects from all namespaces and closes transport.
   *
   * @api private
   */

  disconnect(){
    for (var id in this.sockets) {
      if (this.sockets.hasOwnProperty(id)) {
        this.sockets[id].disconnect();
      }
    }
    this.sockets = {};
    this.close();
  }

  /**
   * Removes a socket. Called by each `Socket`.
   *
   * @api private
   */

  remove(socket){
    if (this.sockets.hasOwnProperty(socket.id)) {
      var nsp = this.sockets[socket.id].nsp.name;
      delete this.sockets[socket.id];
      delete this.nsps[nsp];
    } else {
      debug('ignoring remove for %s', socket.id);
    }
  }

  /**
   * Closes the underlying connection.
   *
   * @api private
   */

  close(){
    if ('open' == this.conn.readyState) {
      debug('forcing transport close');
      this.conn.close();
      this.onclose('forced server close');
    }
  }

  /**
   * Writes a packet to the transport.
   *
   * @param {Object} packet object
   * @param {Object} opts
   * @api private
   */

  packet(packet, opts){
    opts = opts || {};
    var self = this;

    // this writes to the actual connection
    function writeToEngine(encodedPackets) {
      if (opts.volatile && !self.conn.transport.writable) return;
      for (var i = 0; i < encodedPackets.length; i++) {
        self.conn.write(encodedPackets[i], { compress: opts.compress });
      }
    }

    if ('open' == this.conn.readyState) {
      debug('writing packet %j', packet);
      if (!opts.preEncoded) { // not broadcasting, need to encode
        this.encoder.encode(packet, function (encodedPackets) { // encode, then write results to engine
          writeToEngine(encodedPackets);
        });
      } else { // a broadcast pre-encodes a packet
        writeToEngine(packet);
      }
    } else {
      debug('ignoring packet write %j', packet);
    }
  }

  /**
   * Called with incoming transport data.
   *
   * @api private
   */

  ondata(data){
    // try/catch is needed for protocol violations (GH-1880)
    try {
      this.decoder.add(data);
    } catch(e) {
      this.onerror(e);
    }
  }

  /**
   * Called when parser fully decodes a packet.
   *
   * @api private
   */

  ondecoded(packet) {
    if (parser.CONNECT == packet.type) {
      this.connect(url.parse(packet.nsp).pathname, url.parse(packet.nsp, true).query);
    } else {
      var socket = this.nsps[packet.nsp];
      if (socket) {
        socket.onpacket(packet);
      } else {
        debug('no socket for namespace %s', packet.nsp);
      }
    }
  }

  /**
   * Handles an error.
   *
   * @param {Object} err object
   * @api private
   */

  onerror(err){
    for (var id in this.sockets) {
      if (this.sockets.hasOwnProperty(id)) {
        this.sockets[id].onerror(err);
      }
    }
    this.onclose('client error');
  }

  /**
   * Called upon transport close.
   *
   * @param {String} reason
   * @api private
   */

  onclose(reason){
    debug('client close with reason %s', reason);

    // ignore a potential subsequent `close` event
    this.destroy();

    // `nsps` and `sockets` are cleaned up seamlessly
    for (var id in this.sockets) {
      if (this.sockets.hasOwnProperty(id)) {
        this.sockets[id].onclose(reason);
      }
    }
    this.sockets = {};

    this.decoder.destroy(); // clean up decoder
  }

  /**
   * Cleans up event listeners.
   *
   * @api private
   */

  destroy(){
    this.conn.removeListener('data', this.ondata);
    this.conn.removeListener('error', this.onerror);
    this.conn.removeListener('close', this.onclose);
    this.decoder.removeListener('decoded', this.ondecoded);
  }

}

/**
 * Module exports.
 */

//module.exports = Client;


/***********************
NAMESPACE.JS
********************/
//'use strict';

/**
 * Module dependencies.
 */

//var Socket = require('./socket');  SAME CLASS NAME
var Emitter = require('events').EventEmitter;
var parser = require('socket.io-parser');
var debug = require('debug')('socket.io:namespace');
var hasBin = require('has-binary');

/**
 * Blacklisted events.
 */

var exportsEvents = [
  'connect',    // for symmetry with client
  'connection',
  'newListener'
];

/**
 * Flags.
 */

var exportsFlags = [
  'json', 
  'volatile'
];

/**
 * `EventEmitter#emit` reference.
 */

var emit = Emitter.prototype.emit;

/**
 * Namespace constructor.
 *
 * @param {Server} server instance
 * @param {Socket} name
 * @api private
 */

class Namespace extends Emitter {
  constructor(server, name){
    super();  
    this.name = name;
    this.server = server;
    this.sockets = {};
    this.connected = {};
    this.fns = [];
    this.ids = 0;
    this.initAdapter();
  }	
  
  static flags() {
    return exportsFlags;
  }  

  /**
   * Initializes the `Adapter` for this nsp.
   * Run upon changing adapter by `Server#adapter`
   * in addition to the constructor.
   *
   * @api private
   */

  initAdapter(){
    this.adapter = new (this.server.adapter())(this);
  };

  /**
   * Sets up namespace middleware.
   *
   * @return {Namespace} self
   * @api public
   */

  use(fn){
    this.fns.push(fn);
    return this;
  }

  /**
   * Executes the middleware for an incoming client.
   *
   * @param {Socket} socket that will get added
   * @param {Function} fn last fn call in the middleware
   * @api private
   */

  run(socket, fn){
    var fns = this.fns.slice(0);
    if (!fns.length) return fn(null);

    function run(i){
      fns[i](socket, function(err){
        // upon error, short-circuit
        if (err) return fn(err);

        // if no middleware left, summon callback
        if (!fns[i + 1]) return fn(null);

        // go on to next
        run(i + 1);
      });
    }

    run(0);
  }

  /**
   * Targets a room when emitting.
   *
   * @param {String} name
   * @return {Namespace} self
   * @api public
   */

  in(name){
    this.rooms = this.rooms || [];
    if (!~this.rooms.indexOf(name)) this.rooms.push(name);
    return this;
  }

  /**
   * Adds a new client.
   *
   * @return {Socket}
   * @api private
   */

  add(client, query, fn){
    debug('adding socket to nsp %s', this.name);
    var socket = new Socket(this, client, query);
    var self = this;
    this.run(socket, function(err){
      process.nextTick(function(){
        if ('open' == client.conn.readyState) {
          if (err) return socket.error(err.data || err.message);

          // track socket
          self.sockets[socket.id] = socket;

          // it's paramount that the internal `onconnect` logic
          // fires before user-set events to prevent state order
          // violations (such as a disconnection before the connection
          // logic is complete)
          socket.onconnect();
          if (fn) fn();

          // fire user-set events
          self.emit('connect', socket);
          self.emit('connection', socket);
        } else {
          debug('next called after client was closed - ignoring socket');
        }
      });
    });
    return socket;
  }

  /**
   * Removes a client. Called by each `Socket`.
   *
   * @api private
   */

  remove(socket){
    if (this.sockets.hasOwnProperty(socket.id)) {
      delete this.sockets[socket.id];
    } else {
      debug('ignoring remove for %s', socket.id);
    }
  }

  /**
   * Emits to all clients.
   *
   * @return {Namespace} self
   * @api public
   */

  emit(ev){
    if (~exportsEvents.indexOf(ev)) {
      emit.apply(this, arguments);
    } else {
      // set up packet object
      var args = Array.prototype.slice.call(arguments);
      var parserType = parser.EVENT; // default
      if (hasBin(args)) { parserType = parser.BINARY_EVENT; } // binary

      var packet = { type: parserType, data: args };

      if ('function' == typeof args[args.length - 1]) {
        throw new Error('Callbacks are not supported when broadcasting');
      }

      this.adapter.broadcast(packet, {
        rooms: this.rooms,
        flags: this.flags
      });

      delete this.rooms;
      delete this.flags;
    }
    return this;
  }

  /**
   * Sends a `message` event to all clients.
   *
   * @return {Namespace} self
   * @api public
   */

  write(){
    var args = Array.prototype.slice.call(arguments);
    args.unshift('message');
    this.emit.apply(this, args);
    return this;
  }

  /**
   * Gets a list of clients.
   *
   * @return {Namespace} self
   * @api public
   */

  clients(fn){
    this.adapter.clients(this.rooms, fn);
    // delete rooms flag for scenario:
    // .in('room').clients() (GH-1978)
    delete this.rooms;
    return this;
  }

  /**
   * Sets the compress flag.
   *
   * @param {Boolean} compress if `true`, compresses the sending data
   * @return {Socket} self
   * @api public
   */

  compress(compress){
    this.flags = this.flags || {};
    this.flags.compress = compress;
    return this;
  }

}

/**
 * Apply flags from `Socket`.
 */

exportsFlags.forEach(function(flag){
  Namespace.prototype.__defineGetter__(flag, function(){
    this.flags = this.flags || {};
    this.flags[flag] = true;
    return this;
  });
});

/**
 * Methods sharing functions
 */

Namespace.prototype.to = Namespace.prototype.in;
Namespace.prototype.send = Namespace.prototype.write;

/**
 * Module exports.
 */

//module.exports = Namespace;


/****************************
INDEX.JS
*********/
//'use strict';

/**
 * Module dependencies.
 */

var http = require('http');
var read = require('fs').readFileSync;
var engine = require('engine.io');
var client = require('socket.io-client');
var clientVersion = require('socket.io-client/package').version;
//var Client = require('./client');  SAME CLASS NAME
//var Namespace = require('./namespace');  SAME CLASS NAME
var Adapter = require('socket.io-adapter');
var debug = require('debug')('socket.io:server');
var url = require('url');

/**
 * Socket.IO client source.
 */

var clientSource = read(require.resolve('socket.io-client/socket.io.js'), 'utf-8');

/**
 * Old settings for backwards compatibility
 */

var oldSettings = {
  "transports": "transports",
  "heartbeat timeout": "pingTimeout",
  "heartbeat interval": "pingInterval",
  "destroy buffer size": "maxHttpBufferSize"
};

/**
 * Server constructor.
 *
 * @param {http.Server|Number|Object} srv http server, port or options
 * @param {Object} opts
 * @api public
 */

class _Server{
  constructor(srv, opts){
    if ('object' == typeof srv && !srv.listen) {
      opts = srv;
      srv = null;
    }
    opts = opts || {};
    this.nsps = {};
    this.path(opts.path || '/socket.io');
    this.serveClient(false !== opts.serveClient);
    this.adapter(opts.adapter || Adapter);
    this.origins(opts.origins || '*:*');
    this.sockets = this.of('/');
    if (srv) this.attach(srv, opts);
  }
    
  /**
   * Server request verification function, that checks for allowed origins
   *
   * @param {http.IncomingMessage} req request
   * @param {Function} fn callback to be called with the result: `fn(err, success)`
   */

  checkRequest(req, fn) {
    var origin = req.headers.origin || req.headers.referer;

    // file:// URLs produce a null Origin which can't be authorized via echo-back
    if ('null' == origin || null == origin) origin = '*';

    if (!!origin && typeof(this._origins) == 'function') return this._origins(origin, fn);
    if (this._origins.indexOf('*:*') !== -1) return fn(null, true);
    if (origin) {
      try {
        var parts = url.parse(origin);
        var defaultPort = 'https:' == parts.protocol ? 443 : 80;
        parts.port = parts.port != null
          ? parts.port
          : defaultPort;
        var ok =
          ~this._origins.indexOf(parts.hostname + ':' + parts.port) ||
          ~this._origins.indexOf(parts.hostname + ':*') ||
          ~this._origins.indexOf('*:' + parts.port);
        return fn(null, !!ok);
      } catch (ex) {
      }
    }
    fn(null, false);
  }

  /**
   * Sets/gets whether client code is being served.
   *
   * @param {Boolean} v whether to serve client code
   * @return {Server|Boolean} self when setting or value when getting
   * @api public
   */

  serveClient(v){
    if (!arguments.length) return this._serveClient;
    this._serveClient = v;
    return this;
  }

  /**
   * Backwards compatiblity.
   *
   * @api public
   */

  set(key, val){
    if ('authorization' == key && val) {
      this.use(function(socket, next) {
        val(socket.request, function(err, authorized) {
          if (err) return next(new Error(err));
          if (!authorized) return next(new Error('Not authorized'));
          next();
        });
      });
    } else if ('origins' == key && val) {
      this.origins(val);
    } else if ('resource' == key) {
      this.path(val);
    } else if (oldSettings[key] && this.eio[oldSettings[key]]) {
      this.eio[oldSettings[key]] = val;
    } else {
      console.error('Option %s is not valid. Please refer to the README.', key);
    }

    return this;
  }

  /**
   * Sets the client serving path.
   *
   * @param {String} v pathname
   * @return {Server|String} self when setting or value when getting
   * @api public
   */

  path(v){
    if (!arguments.length) return this._path;
    this._path = v.replace(/\/$/, '');
    return this;
  }

  /**
   * Sets the adapter for rooms.
   *
   * @param {Adapter} v pathname
   * @return {Server|Adapter} self when setting or value when getting
   * @api public
   */

  adapter(v){
    if (!arguments.length) return this._adapter;
    this._adapter = v;
    for (var i in this.nsps) {
      if (this.nsps.hasOwnProperty(i)) {
        this.nsps[i].initAdapter();
      }
    }
    return this;
  }

  /**
   * Sets the allowed origins for requests.
   *
   * @param {String} v origins
   * @return {Server|Adapter} self when setting or value when getting
   * @api public
   */

  origins(v){
    if (!arguments.length) return this._origins;

    this._origins = v;
    return this;
  }

  /**
   * Attaches socket.io to a server or port.
   *
   * @param {http.Server|Number} server or port
   * @param {Object} options passed to engine.io
   * @return {Server} self
   * @api public
   */

  attach(srv, opts){
    if ('function' == typeof srv) {
      var msg = 'You are trying to attach socket.io to an express ' +
      'request handler function. Please pass a http.Server instance.';
      throw new Error(msg);
    }

    // handle a port as a string
    if (Number(srv) == srv) {
      srv = Number(srv);
    }

    if ('number' == typeof srv) {
      debug('creating http server and binding to %d', srv);
      var port = srv;
      srv = http.Server(function(req, res){
        res.writeHead(404);
        res.end();
      });
      srv.listen(port);

    }

    // set engine.io path to `/socket.io`
    opts = opts || {};
    opts.path = opts.path || this.path();
    // set origins verification
    opts.allowRequest = opts.allowRequest || this.checkRequest.bind(this);

    // initialize engine
    debug('creating engine.io instance with opts %j', opts);
    this.eio = engine.attach(srv, opts);

    // attach static file serving
    if (this._serveClient) this.attachServe(srv);

    // Export http server
    this.httpServer = srv;

    // bind to engine events
    this.bind(this.eio);

    return this;
  }

  /**
   * Attaches the static file serving.
   *
   * @param {Function|http.Server} srv http server
   * @api private
   */

  attachServe(srv){
    debug('attaching client serving req handler');
    var url = this._path + '/socket.io.js';
    var evs = srv.listeners('request').slice(0);
    var self = this;
    srv.removeAllListeners('request');
    srv.on('request', function(req, res) {
      if (0 === req.url.indexOf(url)) {
        self.serve(req, res);
      } else {
        for (var i = 0; i < evs.length; i++) {
          evs[i].call(srv, req, res);
        }
      }
    });
  }

  /**
   * Handles a request serving `/socket.io.js`
   *
   * @param {http.Request} req
   * @param {http.Response} res
   * @api private
   */

  serve(req, res){
    var etag = req.headers['if-none-match'];
    if (etag) {
      if (clientVersion == etag) {
        debug('serve client 304');
        res.writeHead(304);
        res.end();
        return;
      }
    }

    debug('serve client source');
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('ETag', clientVersion);
    res.writeHead(200);
    res.end(clientSource);
  }

  /**
   * Binds socket.io to an engine.io instance.
   *
   * @param {engine.Server} engine engine.io (or compatible) server
   * @return {Server} self
   * @api public
   */

  bind(engine){
    this.engine = engine;
    this.engine.on('connection', this.onconnection.bind(this));
    return this;
  }

  /**
   * Called with each incoming transport connection.
   *
   * @param {engine.Socket} conn
   * @return {Server} self
   * @api public
   */

  onconnection(conn){
    debug('incoming connection with id %s', conn.id);
    var client = new Client(this, conn);
    client.connect('/');
    return this;
  }

  /**
   * Looks up a namespace.
   *
   * @param {String} name nsp name
   * @param {Function} fn optional, nsp `connection` ev handler
   * @api public
   */

  of(name, fn){
    if (String(name)[0] !== '/') name = '/' + name;
    
    var nsp = this.nsps[name];
    if (!nsp) {
      debug('initializing namespace %s', name);
      nsp = new Namespace(this, name);
      this.nsps[name] = nsp;
    }
    if (fn) nsp.on('connect', fn);
    return nsp;
  }

  /**
   * Closes server connection
   *
   * @api public
   */

  close(){
    for (var id in this.nsps['/'].sockets) {
      if (this.nsps['/'].sockets.hasOwnProperty(id)) {
        this.nsps['/'].sockets[id].onclose();
      }
    }

    this.engine.close();

    if(this.httpServer){
      this.httpServer.close();
    }
  }

}

/**
 * Methods sharing functions
 */
_Server.prototype.listen = _Server.prototype.attach;

/**
 * Expose main namespace (/).
 */

['on', 'to', 'in', 'use', 'emit', 'send', 'write', 'clients', 'compress'].forEach(function(fn){
  _Server.prototype[fn] = function(){
    var nsp = this.sockets[fn];
    return nsp.apply(this.sockets, arguments);
  };
});

Namespace.flags().forEach(function(flag){
  _Server.prototype.__defineGetter__(flag, function(){
    this.sockets.flags = this.sockets.flags || {};
    this.sockets.flags[flag] = true;
    return this;
  });
});

/**
 * BC with `io.listen`
 */

_Server.listen = _Server;

/**
 * function Server 
 */

function Server(srv, opts){
  if (!(this instanceof _Server)) return new _Server(srv, opts);
}

Server.prototype = _Server.prototype;

/**
 * Module exports.
 */

//module.exports = Server;



/******************
TESTS
*/
var testVersion = process.env.TEST_VERSION;
var http = require('http').Server;
var io;
if (testVersion === 'compat') {
  console.log('testing compat version');
  io = require('../dist');
} else {
  io = require('../lib');
}
var fs = require('fs');
var join = require('path').join;
var exec = require('child_process').exec;
var ioc = require('socket.io-client');
var request = require('supertest');
var expect = require('expect.js');

// Creates a socket.io client for the given server
function client(srv, nsp, opts){
  if ('object' == typeof nsp) {
    opts = nsp;
    nsp = null;
  }
  var addr = srv.address();
  if (!addr) addr = srv.listen().address();
  var url = 'ws://localhost:' + addr.port + (nsp || '');
  return ioc(url, opts);
}

describe('socket.io', function(){

  it('should be the same version as client', function(){
    var version = require('../package').version;
    expect(version).to.be(require('socket.io-client/package').version);
  });

  describe('set', function() {
    it('should be able to set ping timeout to engine.io', function() {
      var srv = io(http());
      srv.set('heartbeat timeout', 10);
      expect(srv.eio.pingTimeout).to.be(10);
    });

    it('should be able to set ping interval to engine.io', function() {
      var srv = io(http());
      srv.set('heartbeat interval', 10);
      expect(srv.eio.pingInterval).to.be(10);
    });

    it('should be able to set transports to engine.io', function() {
      var srv = io(http());
      srv.set('transports', ['polling']);
      expect(srv.eio.transports).to.eql(['polling']);
    });

    it('should be able to set maxHttpBufferSize to engine.io', function() {
      var srv = io(http());
      srv.set('destroy buffer size', 10);
      expect(srv.eio.maxHttpBufferSize).to.eql(10);
    });

    it('should be able to set path with setting resource', function(done) {
      var eio = io();
      var srv = http();

      eio.set('resource', '/random');
      eio.attach(srv);

      // Check that the server is accessible through the specified path
      request(srv)
      .get('/random/socket.io.js')
      .buffer(true)
      .end(function(err, res){
        if (err) return done(err);
        done();
      });
    });

    it('should be able to set origins to engine.io', function() {
      var srv = io(http());
      srv.set('origins', 'http://hostname.com:*');
      expect(srv.origins()).to.be('http://hostname.com:*');
    });

    it('should be able to set authorization and send error packet', function(done) {
      var httpSrv = http();
      var srv = io(httpSrv);
      srv.set('authorization', function(o, f) { f(null, false); });

      var socket = client(httpSrv);
      socket.on('connect', function(){
        expect().fail();
      });
      socket.on('error', function(err) {
        expect(err).to.be('Not authorized');
        done();
      });
    });

    it('should be able to set authorization and succeed', function(done) {
      var httpSrv = http();
      var srv = io(httpSrv);
      srv.set('authorization', function(o, f) { f(null, true); });

      srv.on('connection', function(s) {
        s.on('yoyo', function(data) {
          expect(data).to.be('data');
          done();
        });
      });

      var socket = client(httpSrv);
      socket.on('connect', function(){
        socket.emit('yoyo', 'data');
      });

      socket.on('error', function(err) {
        expect().fail();
      });
    });

    it('should set the handshake BC object', function(done){
      var httpSrv = http();
      var srv = io(httpSrv);

      srv.on('connection', function(s) {
        expect(s.handshake).to.not.be(undefined);

        // Headers set and has some valid properties
        expect(s.handshake.headers).to.be.an('object');
        expect(s.handshake.headers['user-agent']).to.be('node-XMLHttpRequest');

        // Time set and is valid looking string
        expect(s.handshake.time).to.be.a('string');
        expect(s.handshake.time.split(' ').length > 0); // Is "multipart" string representation

        // Address, xdomain, secure, issued and url set
        expect(s.handshake.address).to.contain('127.0.0.1');
        expect(s.handshake.xdomain).to.be.a('boolean');
        expect(s.handshake.secure).to.be.a('boolean');
        expect(s.handshake.issued).to.be.a('number');
        expect(s.handshake.url).to.be.a('string');

        // Query set and has some right properties
        expect(s.handshake.query).to.be.an('object');
        expect(s.handshake.query.EIO).to.not.be(undefined);
        expect(s.handshake.query.transport).to.not.be(undefined);
        expect(s.handshake.query.t).to.not.be(undefined);

        done();
      });

      var socket = client(httpSrv);
    });
  });

  describe('server attachment', function(){
    describe('http.Server', function(){
      var clientVersion = require('socket.io-client/package').version;

      it('should serve static files', function(done){
        var srv = http();
        io(srv);
        request(srv)
        .get('/socket.io/socket.io.js')
        .buffer(true)
        .end(function(err, res){
          if (err) return done(err);
          var ctype = res.headers['content-type'];
          expect(ctype).to.be('application/javascript');
          expect(res.headers.etag).to.be(clientVersion);
          expect(res.text).to.match(/engine\.io/);
          expect(res.status).to.be(200);
          done();
        });
      });

      it('should handle 304', function(done){
        var srv = http();
        io(srv);
        request(srv)
        .get('/socket.io/socket.io.js')
        .set('If-None-Match', clientVersion)
        .end(function(err, res){
          if (err) return done(err);
          expect(res.statusCode).to.be(304);
          done();
        });
      });

      it('should not serve static files', function(done){
        var srv = http();
        io(srv, { serveClient: false });
        request(srv)
        .get('/socket.io/socket.io.js')
        .expect(400, done);
      });

      it('should work with #attach', function(done){
        var srv = http(function(req, res){
          res.writeHead(404);
          res.end();
        });
        var sockets = io();
        sockets.attach(srv);
        request(srv)
        .get('/socket.io/socket.io.js')
        .end(function(err, res){
          if (err) return done(err);
          expect(res.status).to.be(200);
          done();
        });
      });
    });

    describe('port', function(done){
      it('should be bound', function(done){
        var sockets = io(54010);
        request('http://localhost:54010')
        .get('/socket.io/socket.io.js')
        .expect(200, done);
      });

      it('should be bound as a string', function(done) {
        var sockets = io('54020');
        request('http://localhost:54020')
        .get('/socket.io/socket.io.js')
        .expect(200, done);
      });

      it('with listen', function(done){
        var sockets = io().listen(54011);
        request('http://localhost:54011')
        .get('/socket.io/socket.io.js')
        .expect(200, done);
      });

      it('as a string', function(done){
        var sockets = io().listen('54012');
        request('http://localhost:54012')
        .get('/socket.io/socket.io.js')
        .expect(200, done);
      });
    });
  });

  describe('handshake', function(){
    var request = require('superagent');

    it('should disallow request when origin defined and none specified', function(done) {
      var sockets = io({ origins: 'http://foo.example:*' }).listen('54013');
      request.get('http://localhost:54013/socket.io/default/')
       .query({ transport: 'polling' })
       .end(function (err, res) {
          expect(res.status).to.be(400);
          done();
        });
    });

    it('should disallow request when origin defined and a different one specified', function(done) {
      var sockets = io({ origins: 'http://foo.example:*' }).listen('54014');
      request.get('http://localhost:54014/socket.io/default/')
       .query({ transport: 'polling' })
       .set('origin', 'http://herp.derp')
       .end(function (err, res) {
          expect(res.status).to.be(400);
          done();
       });
    });

    it('should allow request when origin defined an the same is specified', function(done) {
      var sockets = io({ origins: 'http://foo.example:*' }).listen('54015');
      request.get('http://localhost:54015/socket.io/default/')
       .set('origin', 'http://foo.example')
       .query({ transport: 'polling' })
       .end(function (err, res) {
          expect(res.status).to.be(200);
          done();
        });
    });

    it('should allow request when origin defined as function and same is supplied', function(done) {
      var sockets = io({ origins: function(origin,callback){
        if (origin == 'http://foo.example') {
          return callback(null, true);
        }
        return callback(null, false);
      } }).listen('54016');
      request.get('http://localhost:54016/socket.io/default/')
       .set('origin', 'http://foo.example')
       .query({ transport: 'polling' })
       .end(function (err, res) {
          expect(res.status).to.be(200);
          done();
        });
    });

    it('should allow request when origin defined as function and different is supplied', function(done) {
      var sockets = io({ origins: function(origin,callback){
        if (origin == 'http://foo.example') {
          return callback(null, true);
        }
        return callback(null, false);
      } }).listen('54017');
      request.get('http://localhost:54017/socket.io/default/')
       .set('origin', 'http://herp.derp')
       .query({ transport: 'polling' })
       .end(function (err, res) {
          expect(res.status).to.be(400);
          done();
        });
    });

    it('should allow request when origin defined as function and no origin is supplied', function(done) {
      var sockets = io({ origins: function(origin,callback){
        if (origin == '*') {
          return callback(null, true);
        }
        return callback(null, false);
      } }).listen('54021');
      request.get('http://localhost:54021/socket.io/default/')
       .query({ transport: 'polling' })
       .end(function (err, res) {
          expect(res.status).to.be(200);
          done();
        });
    });

    it('should default to port 443 when protocol is https', function(done) {
      var sockets = io({ origins: 'https://foo.example:443' }).listen('54036');
      request.get('http://localhost:54036/socket.io/default/')
        .set('origin', 'https://foo.example')
        .query({ transport: 'polling' })
        .end(function (err, res) {
          expect(res.status).to.be(200);
          done();
        });
    });

    it('should allow request if custom function in opts.allowRequest returns true', function(done){
      var sockets = io(http().listen(54022), { allowRequest: function (req, callback) {
        return callback(null, true);
      }, origins: 'http://foo.example:*' });

      request.get('http://localhost:54022/socket.io/default/')
       .query({ transport: 'polling' })
       .end(function (err, res) {
          expect(res.status).to.be(200);
          done();
        });
    });

    it('should disallow request if custom function in opts.allowRequest returns false', function(done){
      var sockets = io(http().listen(54023), { allowRequest: function (req, callback) {
        return callback(null, false);
      } });
      request.get('http://localhost:54023/socket.io/default/')
       .set('origin', 'http://foo.example')
       .query({ transport: 'polling' })
       .end(function (err, res) {
          expect(res.status).to.be(400);
          done();
        });
    });
  });

  describe('close', function(){

    it('should be able to close sio sending a srv', function(){
      var PORT   = 54018;
      var srv    = http().listen(PORT);
      var sio    = io(srv);
      var net    = require('net');
      var server = net.createServer();

      var clientSocket = client(srv, { reconnection: false });

      clientSocket.on('disconnect', function init() {
        expect(Object.keys(sio.nsps['/'].sockets).length).to.equal(0);
        server.listen(PORT);
      });

      clientSocket.on('connect', function init() {
        expect(Object.keys(sio.nsps['/'].sockets).length).to.equal(1);
        sio.close();
      });

      server.once('listening', function() {
        // PORT should be free
        server.close(function(error){
          expect(error).to.be(undefined);
        });
      });

    });

    it('should be able to close sio sending a port', function(){
      var PORT   = 54019;
      var sio    = io(PORT);
      var net    = require('net');
      var server = net.createServer();

      var clientSocket = ioc('ws://0.0.0.0:' + PORT);

      clientSocket.on('disconnect', function init() {
        expect(Object.keys(sio.nsps['/'].sockets).length).to.equal(0);
        server.listen(PORT);
      });

      clientSocket.on('connect', function init() {
        expect(Object.keys(sio.nsps['/'].sockets).length).to.equal(1);
        sio.close();
      });

      server.once('listening', function() {
        // PORT should be free
        server.close(function(error){
          expect(error).to.be(undefined);
        });
      });
    });

    describe('graceful close', function(){
      function fixture(filename) {
        return '"' + process.execPath + '" "' +
          join(__dirname, 'fixtures', filename) + '"';
      }

      it('should stop socket and timers', function(done){
        exec(fixture('server-close.js'), done);
      });
    });
  });

  describe('namespaces', function(){
    //var Socket;  SAME CLASS NAME
    //if (testVersion === 'compat') {
    //  Socket = require('../dist/socket');
    //} else {
    //  Socket = require('../lib/socket');
    //}
    //var Namespace;  SAME CLASS NAME
    //if (testVersion === 'compat') {
    //  Namespace = require('../dist/namespace');
    //} else {
    //  Namespace = require('../lib/namespace');
    //}
    it('should be accessible through .sockets', function(){
      var sio = io();
      expect(sio.sockets).to.be.a(Namespace);
    });

    it('should be aliased', function(){
      var sio = io();
      expect(sio.use).to.be.a('function');
      expect(sio.to).to.be.a('function');
      expect(sio['in']).to.be.a('function');
      expect(sio.emit).to.be.a('function');
      expect(sio.send).to.be.a('function');
      expect(sio.write).to.be.a('function');
      expect(sio.clients).to.be.a('function');
      expect(sio.compress).to.be.a('function');
      expect(sio.json).to.be(sio);
      expect(sio.volatile).to.be(sio);
      expect(sio.sockets.flags).to.eql({ json: true, volatile: true });
      delete sio.sockets.flags;
    });

    it('should automatically connect', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        socket.on('connect', function(){
          done();
        });
      });
    });

    it('should fire a `connection` event', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(socket){
          expect(socket).to.be.a(Socket);
          done();
        });
      });
    });

    it('should fire a `connect` event', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connect', function(socket){
          expect(socket).to.be.a(Socket);
          done();
        });
      });
    });

    it('should work with many sockets', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        sio.of('/chat');
        sio.of('/news');
        var chat = client(srv, '/chat');
        var news = client(srv, '/news');
        var total = 2;
        chat.on('connect', function(){
          --total || done();
        });
        news.on('connect', function(){
          --total || done();
        });
      });
    });

    it('should be able to equivalently start with "" or "/" on server', function(done){
      var srv = http();
      var sio = io(srv);
      var total = 2;
      sio.of('').on('connection', function(){
        --total || done();
      });
      sio.of('abc').on('connection', function(){
        --total || done();
      });
      var c1 = client(srv, '/');
      var c2 = client(srv, '/abc');
    });

    it('should be equivalent for "" and "/" on client', function(done){
      var srv = http();
      var sio = io(srv);
      sio.of('/').on('connection', function(){
          done();
      });
      var c1 = client(srv, '');
    });

    it('should work with `of` and many sockets', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var chat = client(srv, '/chat');
        var news = client(srv, '/news');
        var total = 2;
        sio.of('/news').on('connection', function(socket){
          expect(socket).to.be.a(Socket);
          --total || done();
        });
        sio.of('/news').on('connection', function(socket){
          expect(socket).to.be.a(Socket);
          --total || done();
        });
      });
    });

    it('should work with `of` second param', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var chat = client(srv, '/chat');
        var news = client(srv, '/news');
        var total = 2;
        sio.of('/news', function(socket){
          expect(socket).to.be.a(Socket);
          --total || done();
        });
        sio.of('/news', function(socket){
          expect(socket).to.be.a(Socket);
          --total || done();
        });
      });
    });

    it('should disconnect upon transport disconnection', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var chat = client(srv, '/chat');
        var news = client(srv, '/news');
        var total = 2;
        var totald = 2;
        var s;
        sio.of('/news', function(socket){
          socket.on('disconnect', function(reason){
            --totald || done();
          });
          --total || close();
        });
        sio.of('/chat', function(socket){
          s = socket;
          socket.on('disconnect', function(reason){
            --totald || done();
          });
          --total || close();
        });
        function close(){
          s.disconnect(true);
        }
      });
    });

    it('should disconnect both default and custom namespace upon disconnect', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var lolcats = client(srv, '/lolcats');
        var total = 2;
        var totald = 2;
        var s;
        sio.of('/', function(socket){
          socket.on('disconnect', function(reason){
            --totald || done();
          });
          --total || close();
        });
        sio.of('/lolcats', function(socket){
          s = socket;
          socket.on('disconnect', function(reason){
            --totald || done();
          });
          --total || close();
        });
        function close(){
          s.disconnect(true);
        }
      });
    });

    it('should not crash while disconnecting socket', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv,'/ns');
        sio.on('connection', function(socket){
          socket.disconnect();
          done();
        });
      });
    });

    it('should return error connecting to non-existent namespace', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv,'/doesnotexist');
        socket.on('error', function(err) {
          expect(err).to.be('Invalid namespace');
          done();
        });
      });
    });
    
    it('should not reuse same-namespace connections', function(done){
      var srv = http();
      var sio = io(srv);
      var connections = 0;

      srv.listen(function() {
        var clientSocket1 = client(srv);
        var clientSocket2 = client(srv);
        sio.on('connection', function() {
          connections++;
          if (connections === 2) {
            done();
          }
        });
      });
    });

    it('should find all clients in a namespace', function(done){
      var srv = http();
      var sio = io(srv);
      var chatSids = [];
      var otherSid = null;
      srv.listen(function(){
        var c1 = client(srv, '/chat');
        var c2 = client(srv, '/chat', {forceNew: true});
        var c3 = client(srv, '/other', {forceNew: true});
        var total = 3;
        sio.of('/chat').on('connection', function(socket){
          chatSids.push(socket.id);
          --total || getClients();
        });
        sio.of('/other').on('connection', function(socket){
          otherSid = socket.id;
          --total || getClients();
        });
      });
      function getClients() {
        sio.of('/chat').clients(function(error, sids) {
          expect(error).to.not.be.ok();
          expect(sids).to.contain(chatSids[0]);
          expect(sids).to.contain(chatSids[1]);
          expect(sids).to.not.contain(otherSid);
          done();
        });
      }
    });

    it('should find all clients in a namespace room', function(done){
      var srv = http();
      var sio = io(srv);
      var chatFooSid = null;
      var chatBarSid = null;
      var otherSid = null;
      srv.listen(function(){
        var c1 = client(srv, '/chat');
        var c2 = client(srv, '/chat', {forceNew: true});
        var c3 = client(srv, '/other', {forceNew: true});
        var chatIndex = 0;
        var total = 3;
        sio.of('/chat').on('connection', function(socket){
          if (chatIndex++) {
            socket.join('foo', function() {
              chatFooSid = socket.id;
              --total || getClients();
            });
          } else {
            socket.join('bar', function() {
              chatBarSid = socket.id;
              --total || getClients();
            });
          }
        });
        sio.of('/other').on('connection', function(socket){
          socket.join('foo', function() {
            otherSid = socket.id;
            --total || getClients();
          });
        });
      });
      function getClients() {
        sio.of('/chat').in('foo').clients(function(error, sids) {
          expect(error).to.not.be.ok();
          expect(sids).to.contain(chatFooSid);
          expect(sids).to.not.contain(chatBarSid);
          expect(sids).to.not.contain(otherSid);
          done();
        });
      }
    });

    it('should find all clients across namespace rooms', function(done){
      var srv = http();
      var sio = io(srv);
      var chatFooSid = null;
      var chatBarSid = null;
      var otherSid = null;
      srv.listen(function(){
        var c1 = client(srv, '/chat');
        var c2 = client(srv, '/chat', {forceNew: true});
        var c3 = client(srv, '/other', {forceNew: true});
        var chatIndex = 0;
        var total = 3;
        sio.of('/chat').on('connection', function(socket){
          if (chatIndex++) {
            socket.join('foo', function() {
              chatFooSid = socket.id;
              --total || getClients();
            });
          } else {
            socket.join('bar', function() {
              chatBarSid = socket.id;
              --total || getClients();
            });
          }
        });
        sio.of('/other').on('connection', function(socket){
          socket.join('foo', function() {
            otherSid = socket.id;
            --total || getClients();
          });
        });
      });
      function getClients() {
        sio.of('/chat').clients(function(error, sids) {
          expect(error).to.not.be.ok();
          expect(sids).to.contain(chatFooSid);
          expect(sids).to.contain(chatBarSid);
          expect(sids).to.not.contain(otherSid);
          done();
        });
      }
    });

    it('should not emit volatile event after regular event', function(done) {
      var srv = http();
      var sio = io(srv);

      var counter = 0;
      srv.listen(function(){
        sio.of('/chat').on('connection', function(s){
          // Wait to make sure there are no packets being sent for opening the connection
          setTimeout(function() {
            sio.of('/chat').emit('ev', 'data');
            sio.of('/chat').volatile.emit('ev', 'data');
          }, 50);
        });

        var socket = client(srv, '/chat');
        socket.on('ev', function() {
          counter++;
        });
      });

      setTimeout(function() {
        expect(counter).to.be(1);
        done();
      }, 500);
    });

    it('should emit volatile event', function(done) {
      var srv = http();
      var sio = io(srv);

      var counter = 0;
      srv.listen(function(){
        sio.of('/chat').on('connection', function(s){
          // Wait to make sure there are no packets being sent for opening the connection
          setTimeout(function() {
            sio.of('/chat').volatile.emit('ev', 'data');
          }, 100);
        });

        var socket = client(srv, '/chat');
        socket.on('ev', function() {
          counter++;
        });
      });

      setTimeout(function() {
        expect(counter).to.be(1);
        done();
      }, 500);
    });

    it('should enable compression by default', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv, '/chat');
        sio.of('/chat').on('connection', function(s){
          s.conn.once('packetCreate', function(packet) {
            expect(packet.options.compress).to.be(true);
            done();
          });
          sio.of('/chat').emit('woot', 'hi');
        });
      });
    });

    it('should disable compression', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv, '/chat');
        sio.of('/chat').on('connection', function(s){
          s.conn.once('packetCreate', function(packet) {
            expect(packet.options.compress).to.be(false);
            done();
          });
          sio.of('/chat').compress(false).emit('woot', 'hi');
        });
      });
    });
  });

  describe('socket', function(){

    it('should not fire events more than once after manually reconnecting', function(done) {
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var clientSocket = client(srv, { reconnection: false });
        clientSocket.on('connect', function init() {
          clientSocket.removeListener('connect', init);
          clientSocket.io.engine.close();

          clientSocket.connect();
          clientSocket.on('connect', function() {
            done();
          });
        });
      });
    });

    it('should not fire reconnect_failed event more than once when server closed', function(done) {
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var clientSocket = client(srv, { reconnectionAttempts: 3, reconnectionDelay: 10 });
        clientSocket.on('connect', function() {
          srv.close();
        });

        clientSocket.on('reconnect_failed', function() {
          done();
        });
      });
    });

    it('should receive events', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.on('random', function(a, b, c){
            expect(a).to.be(1);
            expect(b).to.be('2');
            expect(c).to.eql([3]);
            done();
          });
          socket.emit('random', 1, '2', [3]);
        });
      });
    });

    it('should receive message events through `send`', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.on('message', function(a){
            expect(a).to.be(1337);
            done();
          });
          socket.send(1337);
        });
      });
    });

    it('should error with null messages', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.on('message', function(a){
            expect(a).to.be(null);
            done();
          });
          socket.send(null);
        });
      });
    });

    it('should handle transport null messages', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.on('error', function(err){
            expect(err).to.be.an(Error);
            s.on('disconnect', function(reason){
              expect(reason).to.be('client error');
              done();
            });
          });
          s.client.ondata(null);
        });
      });
    });

    it('should emit events', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        socket.on('woot', function(a){
          expect(a).to.be('tobi');
          done();
        });
        sio.on('connection', function(s){
          s.emit('woot', 'tobi');
        });
      });
    });

    it('should emit events with utf8 multibyte character', function(done) {
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        var i = 0;
        socket.on('hoot', function(a){
          expect(a).to.be('utf8 — string');
          i++;

          if (3 == i) {
            done();
          }
        });
        sio.on('connection', function(s){
          s.emit('hoot', 'utf8 — string');
          s.emit('hoot', 'utf8 — string');
          s.emit('hoot', 'utf8 — string');
        });
      });
    });

    it('should emit events with binary data', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        var imageData;
        socket.on('doge', function(a){
          expect(Buffer.isBuffer(a)).to.be(true);
          expect(imageData.length).to.equal(a.length);
          expect(imageData[0]).to.equal(a[0]);
          expect(imageData[imageData.length - 1]).to.equal(a[a.length - 1]);
          done();
        });
        sio.on('connection', function(s){
          fs.readFile(join(__dirname, 'support', 'doge.jpg'), function(err, data){
            if (err) return done(err);
            imageData = data;
            s.emit('doge', data);
          });
        });
      });
    });

    it('should emit events with several types of data (including binary)', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        socket.on('multiple', function(a, b, c, d, e, f){
          expect(a).to.be(1);
          expect(Buffer.isBuffer(b)).to.be(true);
          expect(c).to.be('3');
          expect(d).to.eql([4]);
          expect(Buffer.isBuffer(e)).to.be(true);
          expect(Buffer.isBuffer(f[0])).to.be(true);
          expect(f[1]).to.be('swag');
          expect(Buffer.isBuffer(f[2])).to.be(true);
          done();
        });
        sio.on('connection', function(s){
          fs.readFile(join(__dirname, 'support', 'doge.jpg'), function(err, data){
            if (err) return done(err);
            var buf = new Buffer('asdfasdf', 'utf8');
            s.emit('multiple', 1, data, '3', [4], buf, [data, 'swag', buf]);
          });
        });
      });
    });

    it('should receive events with binary data', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.on('buff', function(a){
            expect(Buffer.isBuffer(a)).to.be(true);
            done();
          });
          var buf = new Buffer('abcdefg', 'utf8');
          socket.emit('buff', buf);
        });
      });
    });

    it('should receive events with several types of data (including binary)', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.on('multiple', function(a, b, c, d, e, f){
          expect(a).to.be(1);
          expect(Buffer.isBuffer(b)).to.be(true);
          expect(c).to.be('3');
          expect(d).to.eql([4]);
          expect(Buffer.isBuffer(e)).to.be(true);
          expect(Buffer.isBuffer(f[0])).to.be(true);
          expect(f[1]).to.be('swag');
          expect(Buffer.isBuffer(f[2])).to.be(true);
          done();
          });
          fs.readFile(join(__dirname, 'support', 'doge.jpg'), function(err, data){
            if (err) return done(err);
            var buf = new Buffer('asdfasdf', 'utf8');
            socket.emit('multiple', 1, data, '3', [4], buf, [data, 'swag', buf]);
          });
        });
      });
    });

    it('should not emit volatile event after regular event (polling)', function(done) {
      var srv = http();
      var sio = io(srv, { transports: ['polling'] });

      var counter = 0;
      srv.listen(function(){
        sio.on('connection', function(s){
          s.emit('ev', 'data');
          s.volatile.emit('ev', 'data');
        });

        var socket = client(srv, { transports: ['polling'] });
        socket.on('ev', function() {
          counter++;
        });
      });

      setTimeout(function() {
        expect(counter).to.be(1);
        done();
      }, 200);
    });

    it('should not emit volatile event after regular event (ws)', function(done) {
      var srv = http();
      var sio = io(srv, { transports: ['websocket'] });

      var counter = 0;
      srv.listen(function(){
        sio.on('connection', function(s){
          s.emit('ev', 'data');
          s.volatile.emit('ev', 'data');
        });

        var socket = client(srv, { transports: ['websocket'] });
        socket.on('ev', function() {
          counter++;
        });
      });

      setTimeout(function() {
        expect(counter).to.be(1);
        done();
      }, 200);
    });

    it('should emit volatile event (polling)', function(done) {
      var srv = http();
      var sio = io(srv, { transports: ['polling'] });

      var counter = 0;
      srv.listen(function(){
        sio.on('connection', function(s){
          // Wait to make sure there are no packets being sent for opening the connection
          setTimeout(function() {
            s.volatile.emit('ev', 'data');
          }, 100);
        });

        var socket = client(srv, { transports: ['polling'] });
        socket.on('ev', function() {
          counter++;
        });
      });

      setTimeout(function() {
        expect(counter).to.be(1);
        done();
      }, 500);
    });

    it('should emit volatile event (ws)', function(done) {
      var srv = http();
      var sio = io(srv, { transports: ['websocket'] });

      var counter = 0;
      srv.listen(function(){
        sio.on('connection', function(s){
          // Wait to make sure there are no packets being sent for opening the connection
          setTimeout(function() {
            s.volatile.emit('ev', 'data');
          }, 20);
        });

        var socket = client(srv, { transports: ['websocket'] });
        socket.on('ev', function() {
          counter++;
        });
      });

      setTimeout(function() {
        expect(counter).to.be(1);
        done();
      }, 200);
    });

    it('should emit only one consecutive volatile event (polling)', function(done) {
      var srv = http();
      var sio = io(srv, { transports: ['polling'] });

      var counter = 0;
      srv.listen(function(){
        sio.on('connection', function(s){
          // Wait to make sure there are no packets being sent for opening the connection
          setTimeout(function() {
            s.volatile.emit('ev', 'data');
            s.volatile.emit('ev', 'data');
          }, 100);
        });

        var socket = client(srv, { transports: ['polling'] });
        socket.on('ev', function() {
          counter++;
        });
      });

      setTimeout(function() {
        expect(counter).to.be(1);
        done();
      }, 500);
    });

    it('should emit only one consecutive volatile event (ws)', function(done) {
      var srv = http();
      var sio = io(srv, { transports: ['websocket'] });

      var counter = 0;
      srv.listen(function(){
        sio.on('connection', function(s){
          // Wait to make sure there are no packets being sent for opening the connection
          setTimeout(function() {
            s.volatile.emit('ev', 'data');
            s.volatile.emit('ev', 'data');
          }, 20);
        });

        var socket = client(srv, { transports: ['websocket'] });
        socket.on('ev', function() {
          counter++;
        });
      });

      setTimeout(function() {
        expect(counter).to.be(1);
        done();
      }, 200);
    });

    it('should emit regular events after trying a failed volatile event (polling)', function(done) {
      var srv = http();
      var sio = io(srv, { transports: ['polling'] });

      var counter = 0;
      srv.listen(function(){
        sio.on('connection', function(s){
          // Wait to make sure there are no packets being sent for opening the connection
          setTimeout(function() {
            s.emit('ev', 'data');
            s.volatile.emit('ev', 'data');
            s.emit('ev', 'data');
          }, 20);
        });

        var socket = client(srv, { transports: ['polling'] });
        socket.on('ev', function() {
          counter++;
        });
      });

      setTimeout(function() {
        expect(counter).to.be(2);
        done();
      }, 200);
    });

    it('should emit regular events after trying a failed volatile event (ws)', function(done) {
      var srv = http();
      var sio = io(srv, { transports: ['websocket'] });

      var counter = 0;
      srv.listen(function(){
        sio.on('connection', function(s){
          // Wait to make sure there are no packets being sent for opening the connection
          setTimeout(function() {
            s.emit('ev', 'data');
            s.volatile.emit('ev', 'data');
            s.emit('ev', 'data');
          }, 20);
        });

        var socket = client(srv, { transports: ['websocket'] });
        socket.on('ev', function() {
          counter++;
        });
      });

      setTimeout(function() {
        expect(counter).to.be(2);
        done();
      }, 200);
    });

    it('should emit message events through `send`', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        socket.on('message', function(a){
          expect(a).to.be('a');
          done();
        });
        sio.on('connection', function(s){
          s.send('a');
        });
      });
    });

    it('should receive event with callbacks', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.on('woot', function(fn){
            fn(1, 2);
          });
          socket.emit('woot', function(a, b){
            expect(a).to.be(1);
            expect(b).to.be(2);
            done();
          });
        });
      });
    });

    it('should receive all events emitted from namespaced client immediately and in order', function(done) {
      var srv = http();
      var sio = io(srv);
      var total = 0;
      srv.listen(function(){
        sio.of('/chat', function(s){
          s.on('hi', function(letter){
            total++;
            if (total == 2 && letter == 'b') {
              done();
            } else if (total == 1 && letter != 'a') {
              throw new Error('events out of order');
            }
          });
        });

        var chat = client(srv, '/chat');
        chat.emit('hi', 'a');
        setTimeout(function() {
          chat.emit('hi', 'b');
        }, 50);
      });
    });

    it('should emit events with callbacks', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          socket.on('hi', function(fn){
            fn();
          });
          s.emit('hi', function(){
            done();
          });
        });
      });
    });

    it('should receive events with args and callback', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.on('woot', function(a, b, fn){
            expect(a).to.be(1);
            expect(b).to.be(2);
            fn();
          });
          socket.emit('woot', 1, 2, function(){
            done();
          });
        });
      });
    });

    it('should emit events with args and callback', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          socket.on('hi', function(a, b, fn){
            expect(a).to.be(1);
            expect(b).to.be(2);
            fn();
          });
          s.emit('hi', 1, 2, function(){
            done();
          });
        });
      });
    });

    it('should receive events with binary args and callbacks', function(done) {
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.on('woot', function(buf, fn){
            expect(Buffer.isBuffer(buf)).to.be(true);
            fn(1, 2);
          });
          socket.emit('woot', new Buffer(3), function(a, b){
            expect(a).to.be(1);
            expect(b).to.be(2);
            done();
          });
        });
      });
    });

    it('should emit events with binary args and callback', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          socket.on('hi', function(a, fn){
            expect(Buffer.isBuffer(a)).to.be(true);
            fn();
          });
          s.emit('hi', new Buffer(4), function(){
            done();
          });
        });
      });
    });

    it('should emit events and receive binary data in a callback', function(done) {
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          socket.on('hi', function(fn){
            fn(new Buffer(1));
          });
          s.emit('hi', function(a){
            expect(Buffer.isBuffer(a)).to.be(true);
            done();
          });
        });
      });
    });

    it('should receive events and pass binary data in a callback', function(done) {
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.on('woot', function(fn){
            fn(new Buffer(2));
          });
          socket.emit('woot', function(a){
            expect(Buffer.isBuffer(a)).to.be(true);
            done();
          });
        });
      });
    });

    it('should have access to the client', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          expect(s.client).to.be.an('object');
          done();
        });
      });
    });

    it('should have access to the connection', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          expect(s.client.conn).to.be.an('object');
          expect(s.conn).to.be.an('object');
          done();
        });
      });
    });

    it('should have access to the request', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          expect(s.client.request.headers).to.be.an('object');
          expect(s.request.headers).to.be.an('object');
          done();
        });
      });
    });

    it('should see query parameters in the request', function(done) {
      var srv = http();
      var sio = io(srv);
      srv.listen(function() {
        var addr = srv.listen().address();
        var url = 'ws://localhost:' + addr.port + '?key1=1&key2=2';
        var socket = ioc(url);
        sio.on('connection', function(s) {
          var parsed = require('url').parse(s.request.url);
          var query = require('querystring').parse(parsed.query);
          expect(query.key1).to.be('1');
          expect(query.key2).to.be('2');
          done();
        });
      });
    });
    
    it('should see query parameters sent from secondary namespace connections in handshake object', function(done){
      var srv = http();
      var sio = io(srv);
      var addr = srv.listen().address();
      var url = 'ws://localhost:' + addr.port;
      var client1 = ioc(url);
      var client2 = ioc(url + '/connection2', {query: {key1: 'aa', key2: '&=bb'}});
      sio.on('connection', function(s){
      });
      sio.of('/connection2').on('connection', function(s){
        expect(s.handshake.query.key1).to.be('aa');
        expect(s.handshake.query.key2).to.be('&=bb');
        done();
      });


    });

    it('should handle very large json', function(done){
      this.timeout(30000);
      var srv = http();
      var sio = io(srv, { perMessageDeflate: false });
      var received = 0;
      srv.listen(function(){
        var socket = client(srv);
        socket.on('big', function(a){
          expect(Buffer.isBuffer(a.json)).to.be(false);
          if (++received == 3)
            done();
          else
            socket.emit('big', a);
        });
        sio.on('connection', function(s){
          fs.readFile(join(__dirname, 'fixtures', 'big.json'), function(err, data){
            if (err) return done(err);
            data = JSON.parse(data);
            s.emit('big', {hello: 'friend', json: data});
          });
          s.on('big', function(a){
            s.emit('big', a);
          });
        });
      });
    });

    it('should handle very large binary data', function(done){
      this.timeout(30000);
      var srv = http();
      var sio = io(srv, { perMessageDeflate: false });
      var received = 0;
      srv.listen(function(){
        var socket = client(srv);
        socket.on('big', function(a){
          expect(Buffer.isBuffer(a.image)).to.be(true);
          if (++received == 3)
            done();
          else
            socket.emit('big', a);
        });
        sio.on('connection', function(s){
          fs.readFile(join(__dirname, 'fixtures', 'big.jpg'), function(err, data){
            if (err) return done(err);
            s.emit('big', {hello: 'friend', image: data});
          });
          s.on('big', function(a){
            expect(Buffer.isBuffer(a.image)).to.be(true);
            s.emit('big', a);
          });
        });
      });
    });

    it('should be able to emit after server close and restart', function(done){
      var srv = http();
      var sio = io(srv);

      sio.on('connection', function(socket){
        socket.on('ev', function(data){
          expect(data).to.be('payload');
          done();
        });
      });

      srv.listen(function(){
        var port = srv.address().port;
        var clientSocket = client(srv, { reconnectionAttempts: 10, reconnectionDelay: 100 });
        clientSocket.once('connect', function(){
          srv.close(function(){
            srv.listen(port, function(){
              clientSocket.on('reconnect', function(){
                clientSocket.emit('ev', 'payload');
              });
            });
          });
        });
      });
    });

    it('should enable compression by default', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv, '/chat');
        sio.of('/chat').on('connection', function(s){
          s.conn.once('packetCreate', function(packet) {
            expect(packet.options.compress).to.be(true);
            done();
          });
          sio.of('/chat').emit('woot', 'hi');
        });
      });
    });

    it('should disable compression', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv, '/chat');
        sio.of('/chat').on('connection', function(s){
          s.conn.once('packetCreate', function(packet) {
            expect(packet.options.compress).to.be(false);
            done();
          });
          sio.of('/chat').compress(false).emit('woot', 'hi');
        });
      });
    });

    it('should error with raw binary and warn', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.conn.on('upgrade', function(){
            console.log('\033[96mNote: warning expected and normal in test.\033[39m');
            socket.io.engine.write('5woooot');
            setTimeout(function(){
              done();
            }, 100);
          });
        });
      });
    });

    it('should not crash with raw binary', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.once('error', function(err){
            expect(err.message).to.match(/Illegal attachments/);
            done();
          });
          s.conn.on('upgrade', function(){
            socket.io.engine.write('5woooot');
          });
        });
      });
    });

    it('should handle empty binary packet', function(done){
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.once('error', function(err){
            expect(err.message).to.match(/Illegal attachments/);
            done();
          });
          s.conn.on('upgrade', function(){
            socket.io.engine.write('5');
          });
        });
      });
    });

    it('should not crash when messing with Object prototype', function(done){
      Object.prototype.foo = 'bar';
      var srv = http();
      var sio = io(srv);
      srv.listen(function(){
        var socket = client(srv);

        sio.on('connection', function(s){
          s.disconnect(true);
          sio.close();
          setTimeout(function(){
            done();
          }, 100);
        });
      });
    });

    it('should always trigger the callback (if provided) when joining a room', function(done){
      var srv = http();
      var sio = io(srv);

      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.join('a', function(){
            s.join('a', done);
          });
        });
      });
    });

  });

  describe('messaging many', function(){
    it('emits to a namespace', function(done){
      var srv = http();
      var sio = io(srv);
      var total = 2;

      srv.listen(function(){
        var socket1 = client(srv, { multiplex: false });
        var socket2 = client(srv, { multiplex: false });
        var socket3 = client(srv, '/test');
        socket1.on('a', function(a){
          expect(a).to.be('b');
          --total || done();
        });
        socket2.on('a', function(a){
          expect(a).to.be('b');
          --total || done();
        });
        socket3.on('a', function(){ done(new Error('not')); });

        var sockets = 3;
        sio.on('connection', function(socket){
          --sockets || emit();
        });
        sio.of('/test', function(socket){
          --sockets || emit();
        });

        function emit(){
          sio.emit('a', 'b');
        }
      });
    });

    it('emits binary data to a namespace', function(done){
      var srv = http();
      var sio = io(srv);
      var total = 2;

      srv.listen(function(){
        var socket1 = client(srv, { multiplex: false });
        var socket2 = client(srv, { multiplex: false });
        var socket3 = client(srv, '/test');
        socket1.on('bin', function(a){
          expect(Buffer.isBuffer(a)).to.be(true);
          --total || done();
        });
        socket2.on('bin', function(a){
          expect(Buffer.isBuffer(a)).to.be(true);
          --total || done();
        });
        socket3.on('bin', function(){ done(new Error('not')); });

        var sockets = 3;
        sio.on('connection', function(socket){
          --sockets || emit();
        });
        sio.of('/test', function(socket){
          --sockets || emit();
        });

        function emit(){
          sio.emit('bin', new Buffer(10));
        }
      });
    });

    it('emits to the rest', function(done){
      var srv = http();
      var sio = io(srv);
      var total = 2;

      srv.listen(function(){
        var socket1 = client(srv, { multiplex: false });
        var socket2 = client(srv, { multiplex: false });
        var socket3 = client(srv, '/test');
        socket1.on('a', function(a){
          expect(a).to.be('b');
          socket1.emit('finish');
        });
        socket2.emit('broadcast');
        socket2.on('a', function(){ done(new Error('done')); });
        socket3.on('a', function(){ done(new Error('not')); });

        var sockets = 2;
        sio.on('connection', function(socket){
          socket.on('broadcast', function(){
            socket.broadcast.emit('a', 'b');
          });
          socket.on('finish', function(){
            done();
          });
        });
      });
    });

    it('emits to rooms', function(done){
      var srv = http();
      var sio = io(srv);
      var total = 2;

      srv.listen(function(){
        var socket1 = client(srv, { multiplex: false });
        var socket2 = client(srv, { multiplex: false });

        socket2.on('a', function(){
          done(new Error('not'));
        });
        socket1.on('a', function(){
          done();
        });
        socket1.emit('join', 'woot', function(){
          socket1.emit('emit', 'woot');
        });

        sio.on('connection', function(socket){
          socket.on('join', function(room, fn){
            socket.join(room, fn);
          });

          socket.on('emit', function(room){
            sio.in(room).emit('a');
          });
        });
      });
    });

    it('emits to rooms avoiding dupes', function(done){
      var srv = http();
      var sio = io(srv);
      var total = 2;

      srv.listen(function(){
        var socket1 = client(srv, { multiplex: false });
        var socket2 = client(srv, { multiplex: false });

        socket2.on('a', function(){
          done(new Error('not'));
        });
        socket1.on('a', function(){
          --total || done();
        });
        socket2.on('b', function(){
          --total || done();
        });

        socket1.emit('join', 'woot');
        socket1.emit('join', 'test');
        socket2.emit('join', 'third', function(){
          socket2.emit('emit');
        });

        sio.on('connection', function(socket){
          socket.on('join', function(room, fn){
            socket.join(room, fn);
          });

          socket.on('emit', function(room){
            sio.in('woot').in('test').emit('a');
            sio.in('third').emit('b');
          });
        });
      });
    });

    it('broadcasts to rooms', function(done){
      var srv = http();
      var sio = io(srv);
      var total = 2;

      srv.listen(function(){
        var socket1 = client(srv, { multiplex: false });
        var socket2 = client(srv, { multiplex: false });
        var socket3 = client(srv, { multiplex: false });

        socket1.emit('join', 'woot');
        socket2.emit('join', 'test');
        socket3.emit('join', 'test', function(){
          socket3.emit('broadcast');
        });

        socket1.on('a', function(){
          done(new Error('not'));
        });
        socket2.on('a', function(){
          --total || done();
        });
        socket3.on('a', function(){
          done(new Error('not'));
        });
        socket3.on('b', function(){
          --total || done();
        });

        sio.on('connection', function(socket){
          socket.on('join', function(room, fn){
            socket.join(room, fn);
          });

          socket.on('broadcast', function(){
            socket.broadcast.to('test').emit('a');
            socket.emit('b');
          });
        });
      });
    });

    it('broadcasts binary data to rooms', function(done){
      var srv = http();
      var sio = io(srv);
      var total = 2;

      srv.listen(function(){
        var socket1 = client(srv, { multiplex: false });
        var socket2 = client(srv, { multiplex: false });
        var socket3 = client(srv, { multiplex: false });

        socket1.emit('join', 'woot');
        socket2.emit('join', 'test');
        socket3.emit('join', 'test', function(){
          socket3.emit('broadcast');
        });

        socket1.on('bin', function(data){
          throw new Error('got bin in socket1');
        });
        socket2.on('bin', function(data){
          expect(Buffer.isBuffer(data)).to.be(true);
          --total || done();
        });
        socket2.on('bin2', function(data) {
          throw new Error('socket2 got bin2');
        });
        socket3.on('bin', function(data) {
          throw new Error('socket3 got bin');
        });
        socket3.on('bin2', function(data) {
          expect(Buffer.isBuffer(data)).to.be(true);
          --total || done();
        });

        sio.on('connection', function(socket){
          socket.on('join', function(room, fn){
            socket.join(room, fn);
          });
          socket.on('broadcast', function(){
            socket.broadcast.to('test').emit('bin', new Buffer(5));
            socket.emit('bin2', new Buffer(5));
          });
        });
      });
    });


    it('keeps track of rooms', function(done){
      var srv = http();
      var sio = io(srv);

      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.join('a', function(){
            expect(Object.keys(s.rooms)).to.eql([s.id, 'a']);
            s.join('b', function(){
              expect(Object.keys(s.rooms)).to.eql([s.id, 'a', 'b']);
              s.join( 'c', function(){
                expect(Object.keys(s.rooms)).to.eql([s.id, 'a', 'b', 'c']);
                s.leave('b', function(){
                  expect(Object.keys(s.rooms)).to.eql([s.id, 'a', 'c']);
                  s.leaveAll();
                  expect(Object.keys(s.rooms)).to.eql([]);
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('deletes empty rooms', function(done) {
      var srv = http();
      var sio = io(srv);

      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.join('a', function(){
            expect(s.nsp.adapter.rooms).to.have.key('a');
            s.leave('a', function(){
              expect(s.nsp.adapter.rooms).to.not.have.key('a');
              done();
            });
          });
        });
      });
    });

    it('should properly cleanup left rooms', function(done){
      var srv = http();
      var sio = io(srv);

      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(s){
          s.join('a', function(){
            expect(Object.keys(s.rooms)).to.eql([s.id, 'a']);
            s.join('b', function(){
              expect(Object.keys(s.rooms)).to.eql([s.id, 'a', 'b']);
              s.leave('unknown', function(){
                expect(Object.keys(s.rooms)).to.eql([s.id, 'a', 'b']);
                s.leaveAll();
                expect(Object.keys(s.rooms)).to.eql([]);
                done();
              });
            });
          });
        });
      });
    });
  });

  describe('middleware', function(done){
    //var Socket;  SAME CLASS NAME
    //if (testVersion === 'compat') {
    //  Socket = require('../dist/socket');
    //} else {
    //  Socket = require('../lib/socket');
    //}

    it('should call functions', function(done){
      var srv = http();
      var sio = io(srv);
      var run = 0;
      sio.use(function(socket, next){
        expect(socket).to.be.a(Socket);
        run++;
        next();
      });
      sio.use(function(socket, next){
        expect(socket).to.be.a(Socket);
        run++;
        next();
      });
      srv.listen(function(){
        var socket = client(srv);
        socket.on('connect', function(){
          expect(run).to.be(2);
          done();
        });
      });
    });

    it('should pass errors', function(done){
      var srv = http();
      var sio = io(srv);
      var run = 0;
      sio.use(function(socket, next){
        next(new Error('Authentication error'));
      });
      sio.use(function(socket, next){
        done(new Error('nope'));
      });
      srv.listen(function(){
        var socket = client(srv);
        socket.on('connect', function(){
          done(new Error('nope'));
        });
        socket.on('error', function(err){
          expect(err).to.be('Authentication error');
          done();
        });
      });
    });

    it('should pass `data` of error object', function(done){
      var srv = http();
      var sio = io(srv);
      var run = 0;
      sio.use(function(socket, next){
        var err = new Error('Authentication error');
        err.data = { a: 'b', c: 3 };
        next(err);
      });
      srv.listen(function(){
        var socket = client(srv);
        socket.on('connect', function(){
          done(new Error('nope'));
        });
        socket.on('error', function(err){
          expect(err).to.eql({ a: 'b', c: 3 });
          done();
        });
      });
    });

    it('should only call connection after fns', function(done){
      var srv = http();
      var sio = io(srv);
      sio.use(function(socket, next){
        socket.name = 'guillermo';
        next();
      });
      srv.listen(function(){
        var socket = client(srv);
        sio.on('connection', function(socket){
          expect(socket.name).to.be('guillermo');
          done();
        });
      });
    });

    it('should be ignored if socket gets closed', function(done){
      var srv = http();
      var sio = io(srv);
      var socket;
      sio.use(function(s, next){
        socket.io.engine.on('open', function(){
          socket.io.engine.close();
          s.client.conn.on('close', function(){
            process.nextTick(next);
            setTimeout(function(){
              done();
            }, 50);
          });
        });
      });
      srv.listen(function(){
        socket = client(srv);
        sio.on('connection', function(socket){
          done(new Error('should not fire'));
        });
      });
    });

    it('should call functions in expected order', function(done){
      var srv = http();
      var sio = io(srv);
      var result = [];

      sio.use(function(socket, next) {
        result.push(1);
        setTimeout(next, 50);
      });
      sio.use(function(socket, next) {
        result.push(2);
        setTimeout(next, 50);
      });
      sio.of('/chat').use(function(socket, next) {
        result.push(3);
        setTimeout(next, 50);
      });
      sio.of('/chat').use(function(socket, next) {
        result.push(4);
        setTimeout(next, 50);
      });

      srv.listen(function() {
        var chat = client(srv, '/chat');
        chat.on('connect', function() {
          expect(result).to.eql([1, 2, 3, 4]);
          done();
        });
      });
    });
  });
});
