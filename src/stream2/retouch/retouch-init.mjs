import ReT4 from './retouch-base.mjs';

export default class ReT4Init extends ReT4 {
  constructor(owner, type, prms = { }) {
    super(owner, type, prms);
    // TODO: hack
    // when abort Ret4 send initiator
    if (prms.initiator) {
      this.reT4NotRDYcounter = owner.originWSPs.get(prms.initiator);
    } else {
      this.reT4NotRDYcounter = owner.wsps ? owner.wsps.length : 1;
    }
  }
}
