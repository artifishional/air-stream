import HeadRecord from './record/head-record.js';

class Propagate {
  interrupt() {
    this.$lasted.reject();
  }

  burn(value, token, owner) {
    const rec = new HeadRecord(null, owner, value, token, undefined, owner);
    this.$lasted = rec;
    return rec;
  }
}

export default new Propagate();
