import Record from './record.js';

let ORIGIN_RECORD_ID_COUNTER = 0;

export default class HeadRecord extends Record {
  constructor(value, token, src) {
    super(value, null, src, null);
    ORIGIN_RECORD_ID_COUNTER += 1;
    this.id = ORIGIN_RECORD_ID_COUNTER;
    this.$token = token;
    this.preRejected = false;
  }

  reject() {
    this.preRejected = true;
  }
}
