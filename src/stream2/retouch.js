import ReT4Init from './retouch-init';
import ReT4Abort from './retouch-abort';

/**
 * @readonly
 * @enum {number}
 */
export const RET4_TYPES = {
  ReINIT: 0,
  RACE: 1,
  ABORT: 2,
};

export default class ReT4 {
  static create(src, type) {
    if (type === RET4_TYPES.ReINIT) {
      return new ReT4Init(src);
    }
    if (type === RET4_TYPES.ABORT) {
      return new ReT4Abort(src);
    }
    if (type === RET4_TYPES.RACE) {
      return new ReT4Race(src);
    }
    throw new TypeError('Unsupported reT4 type');
  }
}
