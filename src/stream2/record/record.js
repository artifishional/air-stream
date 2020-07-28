import { EMPTY } from '../signals.js';
/* <debug> */import Debug from '../debug.js';/* </debug> */

let staticOriginRecIDCounter = 0;

export default class Record
  /* <debug> */extends Debug/* </debug> */ {
  constructor(from, _, value, token, head, src) {
    /* <debug> */
    super({ type: 'record' });
    /* </debug> */
    if (!head) {
      staticOriginRecIDCounter += 1;
      this.id = staticOriginRecIDCounter;
      this.$token = token;
      this.head = this;
    } else {
      /**
       * Ссылка на головную запись
       * Головная запись сохраняется, даже для редьюсеров
       * @type {Record}
       */
      this.head = head;
    }
    /* <debug> */
    this.debug.from = from;
    /* </debug> */
    /**
     * Ссылка на поток-создатель
     */
    this.src = src;
    this.value = value;
  }

  // eslint-disable-next-line class-methods-use-this
  get owner() {
    throw new Error('Deprecated property');
  }

  // eslint-disable-next-line class-methods-use-this
  get origin() {
    throw new Error('Deprecated property');
  }

  serializeValue(value = this.value, deep = 2) {
    if (deep < 0) {
      return value ? value.toString() : null;
    }
    if (value && value.toJSON) {
      return value.toJSON();
    }
    // eslint-disable-next-line no-undef
    if (value instanceof Node) {
      return value.nodeName;
    }
    if (Array.isArray(value)) {
      return value.map((elm) => this.serializeValue(elm, deep - 1));
    }
    if (typeof value === 'object') {
      const res = {};
      // eslint-disable-next-line
      for (const key in value) {
        res[key] = this.serializeValue(value[key], deep - 1);
      }
      return res;
    }
    return value;
  }

  toJSON() {
    return {
      value: this.serializeValue(),
      order: this.token.order,
      sttmp: this.token.token.sttmp,
    };
  }

  map(src, fn) {
    if (this.value === EMPTY) {
      return this;
    }
    return new Record(this, null, fn(this.value, this), this.token, this.head, src);
  }

  reject() {
    this.head.reject();
  }

  get token() {
    return this.head.$token;
  }

  filter(src, fn) {
    if (this.value === EMPTY) {
      return this;
    }
    if (fn(this.value, this)) {
      return this;
    }
    return new Record(this, null, EMPTY, this.token, this.head, src);
  }

  // TODO: redic. species set
  from(value, Species = Record, _, src, conf) {
    return new Species(this, null, value, this.token, this.head, src, conf);
  }
}
