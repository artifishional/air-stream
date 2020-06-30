let INSTANCE_ID_COUNTER = 0;

export default class Debug {
  constructor({ type }) {
    INSTANCE_ID_COUNTER += 1;
    this.debug = {
      type,
      id: INSTANCE_ID_COUNTER,
    };
  }

  toString() {
    return `${this.debug.type} ${this.debug.id}`;
  }
}
