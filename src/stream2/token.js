import { DEFAULT_START_TTMP } from './defs';

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

  static compare({ token: { sttmp: x1 } }, { token: { sttmp: x2 } }) {
    return x1 - x2;
  }
}

Token.INITIAL_TOKEN = { token: new Token(DEFAULT_START_TTMP), order: 0 };
