import { EMPTY } from './signals';

export default class Record {
  constructor(src, owner, value, token, head = this) {
    this.origin = head;
    this.value = value;
    this.owner = owner;
    this.token = token;
  }

  map(fn) {
    if (this.value === EMPTY) {
      return this;
    }
    return new Record(this, this.owner, fn(this.value, this), this.token, this.origin);
  }

  filter(fn) {
    if (this.value === EMPTY) {
      return this;
    }
    if (fn(this.value, this)) {
      return this;
    }

    return new Record(this, this.owner, EMPTY, this.token, this.origin);
  }

  // TODO: redic. species set
  from(value, Species = Record, owner = this.owner, conf) {
    return new Species(this, owner, value, this.token, this.origin, conf);
  }
}
