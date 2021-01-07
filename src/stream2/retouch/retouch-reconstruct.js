/* eslint-disable import/extensions */
import ReT4 from './retouch-base.js';

export default class ReT4ReConstruct extends ReT4 {
  // TODO: important: wsps & origin do not proxy
  constructor(owner, type, { origin, wsps, ...prms }) {
    super(owner, type, prms);
    /**
     * Данные активации для каждого входного стрима
     * @type {Array.<Array.<Record>>}
     */
    // TODO: hack
    //  ret4 start on the same unit
    if (origin === owner) {
      this.reT4NotRDYcounter = wsps.length;
    } else {
      this.reT4NotRDYcounter = owner.originWSPs.get(origin);
    }
  }
}
