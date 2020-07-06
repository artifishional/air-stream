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
}

Token.INITIAL_TOKEN = { token: new Token(DEFAULT_START_TTMP), order: 0 };
