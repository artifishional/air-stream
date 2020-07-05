import ReT4 from './retouch-base';
import { RET4_TYPES } from './retouch-types';

export default class ReT4ReConstruct extends ReT4 {
  constructor(owner, data) {
    super(owner, RET4_TYPES.ReCONSTRUCT, data);
    /**
     * Данные активации для каждого входного стрима
     * @type {Array.<Array.<RedRecord>>}
     */
    // TODO: hack
    //  ret4 start on the same unit
    if (data.origin === owner) {
      this.reT4NotRDYcounter = data.wsps.length;
    } else {
      this.reT4NotRDYcounter = owner.originWSPs.get(data.origin);
    }
  }
}
