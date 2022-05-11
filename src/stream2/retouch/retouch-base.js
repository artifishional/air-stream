/* <debug> */import AsyncTask from '../async-task';/* </debug> */
import Token from '../token';
import HeadRecord from '../record/head-record';

export default class ReT4Base {
  /**
   * @param {RedWSP} owner
   * @param {RET4_TYPES} type
   * @param {*} prms
   * @param {Boolean} prms.merge
   * @param {RedWSP} prms.initiator
   */
  constructor(owner, type, prms = { }) {
    this.prms = prms;
    this.type = type;
    this.owner = owner;
    /* <debug> */
    this.reT4completeCTD = new AsyncTask(() => {
      throw new Error(`Uncompleted Ret4 "${this.type}"`);
    });
    /* </debug> */
    // Пустой массив входящих потоков для combine
    if (!this.owner.wsps.length) {
      this.complete();
    }
  }

  getUpdates() {
    if (!this.owner.wsps.length) {
      return [this.owner.createRecordFrom(
        new HeadRecord(
          null,
          Token.INITIAL_TOKEN,
          this.owner.constructor.STATIC_LOCAL_WSP,
        ),
        [],
      )];
    }
    if (this.owner.wsps.length === 1) {
      return this.owner.wsps[0].state;
    }
    return this.owner.wsps
      .map(({ state }) => state)
      .flat()
      .sort(Token.compare);
  }

  fill() {
    this.reT4NotRDYcounter -= 1;
    if (!this.reT4NotRDYcounter) {
      this.complete();
    }
  }

  complete() {
    /* <debug> */
    this.reT4completeCTD.cancel();
    /* </debug> */
    this.owner.onReT4Complete(this, this.getUpdates());
  }

  cancel() {
    /* <debug> */
    this.reT4completeCTD.cancel();
    /* </debug> */
  }
}
