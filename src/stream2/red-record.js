import Record from './record';

/**
 * @readonly
 * @enum {number}
 */
export const RED_REC_STATUS = {
  PENDING: 'PENDING',
  FAILURE: 'FAILURE',
  SUCCESS: 'SUCCESS',
};

/**
 * @readonly
 * @enum {number}
 */
export const RED_REC_SUBORDINATION = {
  MASTER: 'MASTER',
  SLAVE: 'SLAVE',
};

/**
 * @readonly
 * @enum {number}
 */
export const RED_REC_LOCALIZATION = {
  LOCAL: 'LOCAL',
  REMOTE: 'REMOTE',
};

export class RedRecord extends Record {
  /**
   * @param {WSP} src Source wsp
   * @param {WSP} owner Owner stream
   * @param {*} value
   * @param {{sttmp:Number}} token Unique ttmp token
   * @param {Record} head Link on head wsp
   * @param {Record} author
   * @param {RED_REC_STATUS} status
   * @param {RED_REC_SUBORDINATION} subordination
   * @param {RED_REC_LOCALIZATION} localization
   */
  constructor(
    src,
    owner,
    value,
    token,
    head,
    {
      subordination = RED_REC_SUBORDINATION.MASTER,
      status = RED_REC_STATUS.PENDING,
      localization = RED_REC_LOCALIZATION.LOCAL,
    },
  ) {
    super(src, owner, value, token, head);
    this.subordination = subordination;
    this.src = src;
    this.subscribers = new Set();
    this.status = status;
    this.localization = localization;
    this.registered = false;
  }

  /**
   * Когда отправляется запрос на подтверждение (в т.ч. и локальный случай)
   */
  register() {
    this.registered = true;
  }

  /**
   * Прямая отмена (при обнаружении ошибки, преждевременная, ожидает регистрации)
   */
  reject() {
    this.status = RED_REC_STATUS.FAILURE;
  }

  onRecordStatusUpdate(rec, status) {
    /**
     * При ошибке - создавать новый токен, но с аналогичным ttmp
     */
    if (status === RED_REC_STATUS.FAILURE) {
      this.$token = this.token.compromised();
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

  static get STATUS() {
    return RED_REC_STATUS;
  }

  static get SUBORDINATION() {
    return RED_REC_SUBORDINATION;
  }

  static get LOCALIZATION() {
    return RED_REC_LOCALIZATION;
  }
}
