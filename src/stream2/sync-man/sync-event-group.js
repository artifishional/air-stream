export default class SyncEventGroup {
  constructor(own, rec) {
    this.own = own;
    this.rec = rec;
    this.store = [];
  }

  get headRec() {
    return this.rec.head;
  }

  get neighbourWSPCount() {
    return this.own.getNeighbourWSPCount(this.rec);
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
