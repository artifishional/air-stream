import { STD_DISCONNECT_REQ } from './defs';
/* <debug> */import Debug from './debug';/* </debug> */

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
    }
    this.handlers.forEach((hn) => hn.handleCTR(req, data));
  }
}
