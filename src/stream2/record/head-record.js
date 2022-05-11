import Record from './record';

export default class HeadRecord extends Record {
  static ORIGIN_RECORD_ID_COUNTER = 0;

  constructor(value, token, src, originWspUpdates = null) {
    super(value, null, src, originWspUpdates);
    new.target.ORIGIN_RECORD_ID_COUNTER += 1;
    this.id = new.target.ORIGIN_RECORD_ID_COUNTER;
    this.$token = token;
    this.preRejected = false;
  }

  reject() {
    this.preRejected = true;
  }
}
