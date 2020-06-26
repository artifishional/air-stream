export default class SyncEventManagerSingle {
  constructor(own) {
    this.own = own;
  }

  fill(src, cuR) {
    this.own.sncGrpFilledHandler([cuR]);
  }
}
