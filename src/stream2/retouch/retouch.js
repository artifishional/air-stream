import ReT4Init from './retouch-init';
import ReT4Abort from './retouch-abort';
import { RET4_TYPES } from './retouch-types';
import ReT4ReConstruct from './retouch-reconstruct';

export default class ReT4 {
  static create(src, type, data) {
    if (type === RET4_TYPES.ReINIT) {
      return new ReT4Init(src, data);
    }
    if (type === RET4_TYPES.ReCONSTRUCT) {
      return new ReT4ReConstruct(src, data);
    }
    if (type === RET4_TYPES.ABORT) {
      return new ReT4Abort(src, data);
    }
    if (type === RET4_TYPES.RACE) {
      return new ReT4Race(src, data);
    }
    throw new TypeError('Unsupported reT4 type');
  }
}
