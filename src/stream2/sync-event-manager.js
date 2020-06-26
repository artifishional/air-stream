import SyncEventGroup from './sync-event-group';
import Token from './token';

export default class SyncEventManager {
  constructor(own) {
    this.own = own;
    this.sncEvtGrpSchema = new Map(own.originWSpS.map((originWSP) => [
      originWSP.id,
      own.wsps ? own.wsps.filter(
        (wsp) => wsp.originWSpS.includes(originWSP),
      ).length : 1,
    ]));
    this.sncEvtGrpSchema.set(own.constructor.STATIC_LOCAL_WSP.id, own.wsps.length);
    /**
     * На текущий момент считается что не может существовать более одной
     * синхронизируемой группы, так как записи всегда придерживаются очереднсти
     * по времени появления
     */
    this.sncLastEvtGrp = null;
  }

  fill(src, cuR) {
    /* <debug> */
    if (this.sncLastEvtGrp && cuR.head.token.sttmp < this.sncLastEvtGrp.headRec.token.sttmp) {
      throw new TypeError('Unexpected sync state');
    }
    /* </debug> */
    const sncGrp = this.sncLastEvtGrp;
    /**
     * С учетом что уже была сортировка для RWSP Slave
     * здесь могла оказаться только более свежая запись и
     * предыдущая группа уже не может быть синхронизирована
     * по причните того, что устаревшие записи в накопителях
     * были обновлены
     */
    if (sncGrp) {
      if (sncGrp.headRec !== cuR.head
        && (sncGrp.headRec.token !== Token.INITIAL_TOKEN
        || cuR.head.token !== Token.INITIAL_TOKEN)
      ) {
        this.sncLastEvtGrp = null;
        this.own.sncGrpFilledHandler(sncGrp.getUpdates());
      }
    }
    if (!this.sncLastEvtGrp) {
      this.sncLastEvtGrp = this.createGrp(cuR.head, cuR.head.src.id);
    }
    this.sncLastEvtGrp.fill(src, cuR);
  }

  sncGrpFilledHandler(src) {
    this.sncLastEvtGrp = null;
    this.own.sncGrpFilledHandler(src.getUpdates());
  }

  createGrp(headRec, originWSPID) {
    const neighbourWSPCount = this.sncEvtGrpSchema.get(originWSPID);
    return new SyncEventGroup(this, headRec, neighbourWSPCount);
  }
}
