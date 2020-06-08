import { STD_DISCONNECT_REQ } from './defs';

export default class Controller {
  constructor(src) {
    this.src = src;
    this.disconnected = false;
    this.$todisconnect = [];
    this.$tocommand = [];
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

  send(action, data) {
    /* <debug> */
    if (this.disconnected) {
      throw new Error(`${this.src.$label}: This controller is already disconnected`);
    }
    /* </debug> */
    if (action !== STD_DISCONNECT_REQ) {
      this.$tocommand.map((connector) => connector(action, data));
    } else {
      this.disconnected = true;
      this.$todisconnect.map((connector) => connector(action, data));
    }
  }
}
