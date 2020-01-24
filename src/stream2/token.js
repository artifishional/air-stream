export default class Token {
  constructor(sttmp) {
    /**
     * Проверить, не создан ли уже текущий sttmp показатель
     * Если создан, то новый токен становится родственным текущему
     */
    this.sttmp = sttmp;
  }

  compromised() {
    return new Token(this.sttmp);
  }
}
