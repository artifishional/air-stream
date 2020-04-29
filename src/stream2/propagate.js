import HeadRecord from './head-record';

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
