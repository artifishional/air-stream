export default class SyncEventGroup {
  constructor(owner, headRecID, neighbourWSPCount, originWSPID) {
    this.owner = owner;
    this.originWSPID = originWSPID;
    this.headRecID = headRecID;
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
    /* <debug> */
    if (!this.filled) {
      throw new TypeError('Getting access to non filled group.');
    }
    /* </debug> */
    return [...this.store.values()];
  }
}
