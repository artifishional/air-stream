import { STD_DISCONNECT_REQ } from './defs';
/* <debug> */import Debug from './debug';/* </debug> */

class Connection {
  constructor(own) {
    this.own = own;
    this.streams = null;
    this.cb = null;
    this.wsps = null;
    this.connectionsLeft = null;
    this.connections = null;
  }

  activate(streams, cb) {
    this.streams = streams;
    this.cb = cb;
    this.wsps = new Array(streams.length);
    this.connectionsLeft = streams.length;
    this.connections = new Array(streams.length);
    this.streams.map((stream, idx) => stream
      .connect((wsp, hook) => this.onConnect(wsp, hook, idx)));
    if (streams && !streams.length) {
      this.cb([], this.own);
    }
  }

  onConnect(wsp, hook, idx) {
    if (this.own.disconnected) {
      hook();
      return;
    }
    this.connectionsLeft -= 1;
    this.connections[idx] = hook;
    this.wsps[idx] = wsp;
    if (!this.connectionsLeft) {
      this.cb(this.wsps, this.own);
    }
  }

  disconnect() {
    this.disconnected = true;
    this.connections.map((hook) => hook?.());
  }
}

class CTR {
  /**
   * @param {Function} cb (wsps) => void
   * @param {Controller} own
   * @param {Stream2[]} streams
   */
  constructor(own, streams = null, cb = null) {
    this.disconnected = false;
    this.own = own;
    this.lastConnection = null;
    if (streams) {
      this.lastConnection = new Connection(this);
      this.lastConnection.activate(streams, cb);
    }
  }

  get streams() {
    return this.lastConnection?.streams;
  }

  get wsps() {
    return this.lastConnection?.wsps;
  }

  renew(streams, cb) {
    this.disconnected = false;
    const { lastConnection } = this;
    this.lastConnection = new Connection(this);
    this.lastConnection.activate(streams, cb);
    lastConnection?.disconnect();
  }

  disconnect() {
    this.disconnected = true;
    this.lastConnection?.disconnect();
  }
}

export default class Controller
  /* <debug> */extends Debug/* </debug> */ {
  constructor(src) {
    /* <debug> */
    super({ type: 'controller' });
    /* </debug> */
    this.src = src;
    this.disconnected = false;
    this.$todisconnect = [];
    this.$tocommand = [];
    this.handlers = new Set();
    this.childs = [];
  }

  req(name, cb) {
    if (name === STD_DISCONNECT_REQ) {
      this.todisconnect(cb);
    } else if (name === '*') {
      this.to(cb);
    } else {
      this.tocommand((req, data) => req === name && cb(data));
    }
  }

  /**
   * Создание подчиненного контроллера
   * @param {Stream2[]} streams
   * @param {Function} cb (wsps) => void
   * @return {CTR}
   */
  co5s(streams, cb) {
    const res = new CTR(this, streams, cb);
    this.childs.push(res);
    return res;
  }

  todisconnect(...connectors) {
    this.$todisconnect.push(...connectors);
  }

  to(...connectors) {
    this.$todisconnect.push(...connectors);
    this.$tocommand.push(...connectors);
  }

  tocommand(...connectors) {
    this.$tocommand.push(...connectors);
  }

  handleCTR(req, data) {
    this.send(req, data);
  }

  link(hn) {
    this.handlers.add(hn);
  }

  unlink(hn) {
    this.handlers.remove(hn);
  }

  send(req, data) {
    /* <debug> */
    if (this.disconnected) {
      throw new Error(`${this.src.$label}: This controller is already disconnected`);
    }
    /* </debug> */
    if (req !== STD_DISCONNECT_REQ) {
      this.$tocommand.forEach((connector) => connector(req, data));
    } else {
      this.disconnected = true;
      this.$todisconnect.forEach((connector) => connector(req, data));
      this.childs.map((ctr) => ctr.disconnect());
    }
    this.handlers.forEach((hn) => hn.handleCTR(req, data));
  }
}
