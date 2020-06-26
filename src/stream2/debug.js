let INSTANCE_ID_COUNTER = 0;

export default class Debug {
  constructor() {
    INSTANCE_ID_COUNTER += 1;
    this.debug = {
      id: INSTANCE_ID_COUNTER,
    };
  }
}
