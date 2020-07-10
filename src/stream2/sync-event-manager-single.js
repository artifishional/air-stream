export default class SyncEventManagerSingle {
  constructor(own) {
    this.own = own;
  }

  fill(cuR) {
    this.own.sncGrpFilledHandler([cuR]);
  }
}
