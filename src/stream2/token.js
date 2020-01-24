export default class Token {
  constructor(sttmp) {
    this.sttmp = sttmp;
  }

  compromised() {
    return new Token(this.sttmp);
  }
}
