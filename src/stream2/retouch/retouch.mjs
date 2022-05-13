import ReT4Init from './retouch-init.mjs';
import ReT4Abort from './retouch-abort.mjs';
import { RET4_TYPES } from './retouch-types.mjs';
import ReT4ReConstruct from './retouch-reconstruct.mjs';

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
