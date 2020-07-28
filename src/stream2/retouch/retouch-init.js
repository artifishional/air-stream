import ReT4 from './retouch-base.js';

export default class ReT4Init extends ReT4 {
  constructor(owner, type, prms) {
    super(owner, type, prms);
    this.reT4NotRDYcounter = owner.wsps ? owner.wsps.length : 1;
  }
}
