import ReT4Init from './retouch-init.js';
import ReT4Abort from './retouch-abort.js';
import { RET4_TYPES } from './retouch-types.js';
import ReT4ReConstruct from './retouch-reconstruct.js';

export default class ReT4 {
  static create(src, type, prms) {
    if (type === RET4_TYPES.ReINIT) {
      return new ReT4Init(src, type, prms);
    }
    if (type === RET4_TYPES.ReCONSTRUCT) {
      return new ReT4ReConstruct(src, type, prms);
    }
    if (type === RET4_TYPES.ABORT) {
      return new ReT4Abort(src, type, prms);
    }
    if (type === RET4_TYPES.RACE) {
      return new ReT4Race(src, type, prms);
    }
    throw new TypeError('Unsupported reT4 type');
  }
}
