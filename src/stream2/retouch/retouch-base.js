/* <debug> */
import { microtask } from '../../utils';
/* </debug> */

export default class ReT4Base {
  /**
   * @param {RedWSP} owner
   * @param {RET4_TYPES} type
   * @param {*} prms
   * @param {Boolean} prms.merge
   */
  constructor(owner, type, { merge = false } = { }) {
    this.prms = { merge };
    this.type = type;
    this.owner = owner;
    /* <debug> */
    this.reT4completeCTD = microtask(() => {
      throw new Error(`Uncompleted Ret4 "${this.type}"`);
    });
    /* </debug> */
  }

  getUpdates() {
    if (this.owner.wsps.length === 1) {
      return this.owner.wsps[0].state;
    }
    return this.owner.wsps
      .map(({ state }) => state)
      .flat()
      .sort((
        { token: { order: x, token: { sttmp: a } } },
        { token: { order: y, token: { sttmp: b } } },
      ) => a - b || x - y);
  }

  fill() {
    this.reT4NotRDYcounter -= 1;
    if (!this.reT4NotRDYcounter) {
      this.complete();
    }
  }

  complete() {
    /* <debug> */
    this.reT4completeCTD();
    /* </debug> */
    this.owner.onReT4Complete(this, this.getUpdates());
  }
}
