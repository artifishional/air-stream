import SyncEventGroup from './sync-event-group';

export default class SyncEventManager {
  constructor(owner) {
    this.owner = owner;
    this.sncEvtGrpSchema = new Map(owner.originWSpS.map((originWSP) => [
      originWSP.id,
      owner.wsps ? owner.wsps.filter(
        (wsp) => wsp.originWSpS.includes(originWSP),
      ).length : 1,
    ]));
    this.sncEvtGrpQueue = [];
  }

  fill(src, cuR) {
    let sncGrp = this.sncEvtGrpQueue.find(
      ({ headRecID, originWSPID }) => headRecID === cuR.head.id && originWSPID === cuR.head.src.id,
    );
    if (!sncGrp) {
      sncGrp = this.createGrp(cuR.head.id, cuR.head.src.id);
      this.sncEvtGrpQueue.push(sncGrp);
    }
    sncGrp.fill(src, cuR);
  }

  sncGrpFilledHandler() {
    while (this.sncEvtGrpQueue.length && this.sncEvtGrpQueue[0].filled) {
      this.owner.sncGrpFilledHandler(this.sncEvtGrpQueue.shift().getUpdates());
    }
  }

  createGrp(headRecID, originWSPID) {
    const neighbourWSPCount = this.sncEvtGrpSchema.get(originWSPID);
    return new SyncEventGroup(this, headRecID, neighbourWSPCount, originWSPID);
  }
}
