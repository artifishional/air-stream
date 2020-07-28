import RedWSP from './rwsp.js';

export default class RedWSPSlave extends RedWSP {
  /**
   * @augments RedWSP
   * @param {Array.<WSP|RedWSP>|null} wsps Список источников входных данных
   * @param {STATIC_CREATOR_KEY} creatorKey
   * @param args
   */
  constructor(
    wsps,
    args,
    /* <debug> */ creatorKey, /* </debug> */
  ) {
    super(
      wsps,
      { subordination: new.target.SUBORDINATION.SLAVE, ...args },
      /* <debug> */ creatorKey, /* </debug> */
    );
  }
}
