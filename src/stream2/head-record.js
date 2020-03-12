import Record from './record';

export default class HeadRecord extends Record {
  constructor(src, owner, value, token, head) {
    super(src, owner, value, token, head);
    this.rejected = false;
  }

  reject() {
    this.rejected = true;
  }
}
