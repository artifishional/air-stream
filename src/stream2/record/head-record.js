import Record from './record';

export default class HeadRecord extends Record {
  constructor(prev, owner, value, token, head, src) {
    super(prev, owner, value, token, head, src);
    this.preRejected = false;
  }

  reject() {
    this.preRejected = true;
  }
}
