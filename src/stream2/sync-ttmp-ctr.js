import now from 'performance-now';
import Token from './token';
import AsyncTask from './async-task';

const boiler = new Map();

export default new class TTMPSyncCTR {
  constructor() {
    this.order = 0;
    this.token = null;
    this.cbs = [];
    this.asyncCTD = null;
  }

  // eslint-disable-next-line class-methods-use-this
  fromRawData({ sttmp, order = 0 }) {
    return { token: new Token(sttmp), order };
  }

  async() {
    this.order = 0;
    this.token = null;
    this.cbs.map((cb) => cb());
    this.asyncCTD = null;
  }

  get(ttmp = -1) {
    if (ttmp !== -1) {
      if (!boiler.has(ttmp)) {
        boiler.set(ttmp, new Token(ttmp));
      }
      return boiler.get(ttmp);
    }
    if (!this.token) {
      // eslint-disable-next-line
      ttmp = now();
      this.token = new Token(ttmp);
      if (!this.asyncCTD) {
        this.asyncCTD = new AsyncTask(this.async, this);
      }
    }
    this.order += 1;
    return { token: this.token, order: this.order };
  }
}();
