import Record from './record';

/**
 * @readonly
 * @enum {number}
 */
export const RED_REC_STATUS = {
  PENDING: 0,
  FAILURE: -1,
  SUCCESS: 1,
};

/**
 * @readonly
 * @enum {number}
 */
export const RED_REC_SUBORDINATION = {
  MASTER: true,
  SLAVE: false,
};

/**
 * @readonly
 * @enum {number}
 */
export const RED_REC_LOCALIZATION = {
  LOCAL: true,
  REMOTE: false,
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

  register() {
    this.registered = true;
  }

  onRecordStatusUpdate(rec, status) {
    this.status = status;
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
