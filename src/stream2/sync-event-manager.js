import SyncEventGroup from './sync-event-group';
import Token from './token';

export default class SyncEventManager {
  constructor(own) {
    this.own = own;
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
      this.sncLastEvtGrp = this.createGrp(cuR);
    }
    this.sncLastEvtGrp.fill(src, cuR);
  }

  sncGrpFilledHandler(src) {
    this.sncLastEvtGrp = null;
    this.own.sncGrpFilledHandler(src.getUpdates());
  }

  createGrp(rec) {
    const neighbourWSPCount = this.own.originWSPs.get(rec.head.src);
    /* <debug> */
    if (neighbourWSPCount === undefined) {
      throw new Error('Unexpected model state');
    }
    /* </debug> */
    return new SyncEventGroup(this, rec.head, neighbourWSPCount);
  }
}
