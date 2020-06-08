export default class SyncEventGroup {
  constructor(owner, headRec, neighbourWSPCount) {
    this.owner = owner;
    this.headRec = headRec;
    this.neighbourWSPCount = neighbourWSPCount;
    this.store = new Map();
  }

  fill(src, cuR) {
    this.store.set(src, cuR);
    if (this.filled) {
      this.owner.sncGrpFilledHandler(this);
    }
  }

  get filled() {
    return this.store.size === this.neighbourWSPCount;
  }

  getUpdates() {
    return [...this.store.values()];
  }
}
