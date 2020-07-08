import RedWSP from './rwsp';
import { RED_REC_SUBORDINATION } from '../record/red-record';

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
}
