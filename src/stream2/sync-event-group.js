export default class SyncEventGroup {
  constructor(own, headRec, neighbourWSPCount) {
    this.own = own;
    this.headRec = headRec;
    this.neighbourWSPCount = neighbourWSPCount;
    this.store = new Map();
  }

  fill(src, cuR) {
    this.store.set(src, cuR);
    if (this.filled) {
      this.own.sncGrpFilledHandler(this);
    }
  }

  get filled() {
    return this.store.size === this.neighbourWSPCount;
  }

  getUpdates() {
    return [...this.store.values()];
  }
}
