export default class SyncEventManagerSingle {
  constructor(owner) {
    this.owner = owner;
  }

  fill(src, cuR) {
    this.owner.sncGrpFilledHandler([cuR]);
  }
}
