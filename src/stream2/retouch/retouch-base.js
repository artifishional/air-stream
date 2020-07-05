/* <debug> */
import { microtask } from '../../utils';
/* </debug> */

export default class ReT4Base {
  constructor(owner, type, data = null) {
    this.data = data;
    this.type = type;
    this.owner = owner;
    /* <debug> */
    this.reT4completeCTD = microtask(() => {
      throw new Error(`Uncompleted Ret4 "${this.type}"`);
    });
    /* </debug> */
  }

  fill() {
    this.reT4NotRDYcounter -= 1;
    if (!this.reT4NotRDYcounter) {
      this.complete();
    }
  }

  complete(updates) {
    /* <debug> */
    this.reT4completeCTD();
    /* </debug> */
    this.owner.onReT4Complete(this, updates, this.data);
  }
}
