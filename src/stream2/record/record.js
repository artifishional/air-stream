import { EMPTY } from '../signals';
/* <debug> */import Debug from '../debug';/* </debug> */

export default class Record
  /* <debug> */extends Debug/* </debug> */ {
  constructor(
    value,
    head,
    src,
    /* <debug> */from, /* <debug> */
  ) {
    /* <debug> */
    super({ type: 'record' });
    this.debug.from = from;
    /* </debug> */
    this.head = head || this;
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
    if (globalThis.Node) {
      // eslint-disable-next-line no-undef
      if (value instanceof Node) {
        return value.nodeName;
      }
    }
    if (Array.isArray(value)) {
      return value.map((elm) => this.serializeValue(elm, deep - 1));
    }
    if (typeof value === 'object') {
      return Object
        .keys(value)
        .reduce((acc, key) => {
          acc[key] = this.serializeValue(value[key], deep - 1);
          return acc;
        });
    }
    return value;
  }

  toJSON() {
    return {
      id: this.head.id,
      value: this.serializeValue(),
      order: this.token.order,
      sttmp: this.token.token.sttmp,
    };
  }

  map(src, fn) {
    if (this.value === EMPTY) {
      return this;
    }
    return new Record(
      fn(this.value, this),
      this.head,
      src,
      /* <debug> */this, /* </debug> */
    );
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
    return new Record(
      EMPTY,
      this.head,
      src,
      /* <debug> */this, /* </debug> */
    );
  }

  from(value, src) {
    return new Record(
      value,
      this.head,
      src,
      /* <debug> */this, /* </debug> */
    );
  }
}
