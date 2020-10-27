export default class SyncEventManagerSingle {
  constructor(own) {
    this.own = own;
    this.sncLastEvtGrp = null;
  }

  fill(cuR) {
    this.own.sncGrpFilledHandler([cuR]);
  }
}
