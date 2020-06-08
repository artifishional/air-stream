import RedWSP from './rwsp';
import { RED_REC_SUBORDINATION } from './record/red-record';
import { EMPTY } from './signals';
import { STATIC_CREATOR_KEY } from './defs';


export default class RedWSPSlave extends RedWSP {
  /**
   * @augments RedWSP
   * @param {Array.<WSP|RedWSP>|null} wsps Список источников входных данных
   * @param {Boolean = false} reT4able Reinit getter when reT4
   * @param {STATIC_CREATOR_KEY} creatorKey
   * @param args
   */
  constructor(
    wsps,
    { reT4able = false, ...args } = {},
    /* <debug> */ creatorKey, /* </debug> */
  ) {
    super(
      wsps,
      { subordination: RED_REC_SUBORDINATION.SLAVE, reT4able, ...args },
      /* <debug> */ creatorKey, /* </debug> */
    );
  }

  static combine(wsps, proJ) {
    const res = new this(
      wsps,
      {},
      /* <debug> */ STATIC_CREATOR_KEY, /* </debug> */
    );
    res.initiate(() => (_, combined) => {
      if (combined.length < wsps.length || combined.includes()) {
        return EMPTY;
      }
      return proJ(combined.map(({ value }) => value));
    });
    return res;
  }
}
