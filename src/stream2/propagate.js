import HeadRecord from './head-record';

class Propagate {
  interrupt() {
    this.$lasted.reject();
  }

  burn(value, token) {
    const rec = new HeadRecord(null, this, value, token);
    this.$lasted = rec;
    return rec;
  }
}

export default new Propagate();
