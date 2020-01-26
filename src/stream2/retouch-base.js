import { RT4_TYPES } from './defs';

export default class ReT4Base {
  constructor(src) {
    this.src = src;
  }

  static create(src, type) {
    if (type === RT4_TYPES.ReINIT) {
      return new ReT4Init(src);
    }
  }
}