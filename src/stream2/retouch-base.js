/* <debug> */
import { microtask } from '../utils';
/* </debug> */

export default class ReT4Base {
  constructor(owner, type) {
    this.type = type;
    this.owner = owner;
    /* <debug> */
    this.reT4completeCTD = microtask(() => {
      throw new Error(`Uncompleted Ret4 "init" ${this}`);
    });
    /* </debug> */
  }

  complete(updates) {
    /* <debug> */
    this.reT4completeCTD();
    /* </debug> */
    this.owner.onReT4Complete(this, updates);
  }
}
