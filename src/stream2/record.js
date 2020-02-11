import { EMPTY } from './signals';

export default class Record {
  constructor(src, owner, value, token, head = this) {
    /* <@debug> */
    // eslint-disable-next-line no-undef
    if (!(owner instanceof globalThis.WSP)) {
      throw new TypeError('owner must be a WSP');
    }
    /* </@debug> */
    // TODO: TypeCheck
    if (!Number.isInteger(value) && !Array.isArray(value)) {
      throw new TypeError();
    }
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
    this.owner = owner; // only for owned rec
    if (head === this) {
      this.$token = token;
    }
  }

  map(fn) {
    if (this.value === EMPTY) {
      return this;
    }
    return new Record(this, this.owner, fn(this.value, this), this.token, this.head);
  }

  reject() {
    this.owner.reject();
  }

  get token() {
    return this.head.$token;
  }

  filter(fn) {
    if (this.value === EMPTY) {
      return this;
    }
    if (fn(this.value, this)) {
      return this;
    }

    return new Record(this, this.owner, EMPTY, this.token, this.head);
  }

  // TODO: redic. species set
  from(value, Species = Record, owner = this.owner, conf) {
    return new Species(this, owner, value, this.token, this.head, conf);
  }
}
