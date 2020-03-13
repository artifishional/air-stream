import Token from './token';

const boiler = new Map();

export default new class TTMPSyncCTR {
  constructor() {
    this.token = null;
    this.cbs = [];
  }

  get(ttmp = -1) {
    if (ttmp !== -1) {
      if (!boiler.has(ttmp)) {
        boiler.set(ttmp, new Token(ttmp));
      }
      return boiler.get(ttmp);
    }
    if (!this.token) {
      ttmp = globalThis.performance.now();
      this.token = new Token(ttmp);
      queueMicrotask(() => {
        this.token = null;
        this.cbs.map((cb) => cb());
      });
    }
    return this.token;
  }

  async(cb) {
    this.get();
    this.cbs.push(cb);
  }
}();
