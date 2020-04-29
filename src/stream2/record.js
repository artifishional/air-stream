import { EMPTY } from './signals';

export default class Record {
  constructor(prev, owner, value, token, head = this, src) {
    this.prev = prev;
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
    /**
     * Ссылка на головную запись
     * Головная запись сохраняется, даже для редьюсеров
     * @type {Record}
     */
    this.head = head;
    /**
     * @type {Record}
     * @deprecated
     */
    this.origin = head;
    this.value = value;
    /**
     * @type {RedWSP} Поток-владелец (Мастер)
     */
    this.owner = owner; // only for owned rec head->src
    if (head === this) {
      this.$token = token;
    }
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
  from(value, Species = Record, owner = this.owner, conf, src) {
    return new Species(this, owner, value, this.token, this.head, conf, src);
  }
}
