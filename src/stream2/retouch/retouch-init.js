import ReT4 from './retouch-base';
import { RET4_TYPES } from './retouch-types';

export default class ReT4Init extends ReT4 {
  constructor(owner) {
    super(owner, RET4_TYPES.ReINIT);
    this.reT4NotRDYcounter = owner.wsps ? owner.wsps.length : 1;
  }
}
