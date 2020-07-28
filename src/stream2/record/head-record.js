import Record from './record.js';

export default class HeadRecord extends Record {
  constructor(prev, _, value, token, head, src) {
    super(prev, null, value, token, head, src);
    this.preRejected = false;
  }

  reject() {
    this.preRejected = true;
  }
}
