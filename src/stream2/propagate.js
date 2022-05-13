import HeadRecord from './record/head-record.mjs';

class Propagate {
  interrupt() {
    this.$lasted.reject();
  }

  burn(value, token, src) {
    const rec = new HeadRecord(value, token, src);
    this.$lasted = rec;
    return rec;
  }
}

export default new Propagate();
