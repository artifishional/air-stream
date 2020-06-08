import Record from './record/record';

export default class Request {
  constructor(owner) {
    this.owner = owner;
    this.connect = owner.connect;
    queueMicrotask(() => this.send());
    this.id = REQUEST_ID();
  }

  send() {
    // In case the record is rejected due to an error
    if (this.owner.status === Record.STATUS.PENDING) {
      this.connect.on(this);
      this.connect.send({
        type: 'request',
        rid: this.id,
        data: this.owner.value,
      });
    }
  }

  handle(res) {
    if (res.rid === this.id && res.type === 'answer') {
      this.connect.off(this);
      this.owner.onRequestReady(res.data);
    }
  }
}
