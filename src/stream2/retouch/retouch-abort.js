/* eslint-disable import/extensions */
import ReT4 from './retouch-base.js';
import { RET4_TYPES } from './retouch-types.js';

export default class ReT4Abort extends ReT4 {
  constructor(owner, type, prms) {
    // Transform to ReINIT type here
    super(owner, RET4_TYPES.ReINIT, prms);
    this.reT4NotRDYcounter = 1;
  }

  fill(src, evtCmQueue) {
    this.evtCmQueue = evtCmQueue;
    super.fill();
  }

  getUpdates() {
    return this.evtCmQueue;
  }
}
