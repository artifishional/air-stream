import ReT4 from './retouch-base';

export default class ReT4ReConstruct extends ReT4 {
  constructor(owner, type, prms) {
    super(owner, type, prms);
    /**
     * Данные активации для каждого входного стрима
     * @type {Array.<Array.<Record>>}
     */
    // TODO: hack
    //  ret4 start on the same unit
    if (prms.origin === owner) {
      this.reT4NotRDYcounter = prms.wsps.length;
    } else {
      this.reT4NotRDYcounter = owner.originWSPs.get(prms.origin);
    }
  }
}
