import Record from './record';

/**
 * @readonly
 * @enum {number}
 */
export const RED_REC_STATUS = {
  PENDING: { /* <debug> */ PENDING: 'PENDING' /* </debug> */ },
  FAILURE: { /* <debug> */ FAILURE: 'FAILURE' /* </debug> */ },
  SUCCESS: { /* <debug> */ SUCCESS: 'SUCCESS' /* </debug> */ },
};

export class RedRecord extends Record {
  static get STATUS() {
    return RED_REC_STATUS;
  }

  /**
   * @param {WSP} src Source wsp
   * @param {WSP} owner Owner stream
   * @param {*} value
   * @param {{sttmp:Number}} token Unique ttmp token
   * @param {Record} head Link on head wsp
   * @param {Record} prev
   * @param {RED_REC_STATUS} status
   */
  constructor(
    prev,
    owner,
    value,
    token,
    head,
    src,
    status,
  ) {
    super(prev, owner, value, token, head, src);
    this.$subscribers = null;
    this.status = status;
    this.registered = false;
  }

  get subscribers() {
    if (!this.$subscribers) {
      this.$subscribers = new Set();
    }
    return this.$subscribers;
  }

  /**
   * Когда отправляется запрос на подтверждение (в т.ч. и локальный случай)
   */
  register() {
    this.registered = true;
  }

  onRecordStatusUpdate(rec, status) {
    /**
     * При ошибке - создавать новый токен, но с аналогичным ttmp
     */
    if (status === RED_REC_STATUS.FAILURE) {
      this.$token = this.token.token.compromised();
    }
    this.status = status;
    this.subscribers.forEach((rwsp) => rwsp.onRecordStatusUpdate(this, status));
  }

  on(subscriber) {
    this.subscribers.add(subscriber);
  }

  off(subscriber) {
    this.subscribers.delete(subscriber);
  }
}
