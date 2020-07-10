import { EMPTY } from '../signals';
import Debug from '../debug';

let staticOriginRecIDCounter = 0;

export default class Record
  /* <debug> */extends Debug/* </debug> */ {
  constructor(from, owner, value, token, head, src) {
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
    /* <debug> */
    // eslint-disable-next-line no-undef
    if (!(owner instanceof globalThis.WSP)) {
      throw new TypeError('owner must be a WSP');
    }
    /* </debug> */
    this.value = value;
    /**
     * @type {RedWSP} Поток-владелец (Мастер)
     */
    this.owner = owner; // only for owned RedWSP rec !!! not head->src
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
    return new Record(this, this.owner, fn(this.value, this), this.token, this.head, src);
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

    return new Record(this, this.owner, EMPTY, this.token, this.head, src);
  }

  // TODO: redic. species set
  from(value, Species = Record, owner = this.owner, src, conf) {
    return new Species(this, owner, value, this.token, this.head, src, conf);
  }
}
