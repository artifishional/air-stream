const INSTANCE_ID_COUNTER_BY_TYPES = new Map();

export default class Debug {
  constructor({ type }, dbg = {}) {
    this.dbg = dbg;
    INSTANCE_ID_COUNTER_BY_TYPES.set(
      type, (INSTANCE_ID_COUNTER_BY_TYPES.get(type) || 0) + 1,
    );
    this.debug = {
      type,
      id: INSTANCE_ID_COUNTER_BY_TYPES.get(type),
    };
  }

  toString() {
    return `${this.debug.type} ${this.debug.id}`;
  }
}
