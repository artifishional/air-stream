
class Propagate {
  interrupt() {
    this.$lasted.reject();
  }

  burn(rec) {
    this.$lasted = rec;
    return rec;
  }
}

export default new Propagate();
