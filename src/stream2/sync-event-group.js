export default class SyncEventGroup {
  constructor(own, headRec, neighbourWSPCount) {
    this.own = own;
    this.headRec = headRec;
    this.neighbourWSPCount = neighbourWSPCount;
    this.store = [];
  }

  fill(cuR) {
    this.store.push(cuR);
    if (this.filled) {
      this.own.sncGrpFilledHandler(this);
    }
  }

  get filled() {
    return this.neighbourWSPCount === this.store.length;
  }

  getUpdates() {
    return this.store;
  }
}
