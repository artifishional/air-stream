import { DEFAULT_START_TTMP } from './defs';
/* <debug> */ import Debug from './debug'; /* </debug> */

export default class Token
  /* <debug> */extends Debug/* </debug> */ {
  constructor(sttmp) {
    super({ type: 'token' });
    /**
     * Проверить, не создан ли уже текущий sttmp показатель
     * Если создан, то новый токен становится родственным текущему
     */
    this.sttmp = sttmp;
  }

  compromised() {
    return new Token(this.sttmp);
  }

  static compare(
    { token: { order: x, token: { sttmp: a } } },
    { token: { order: y, token: { sttmp: b } } },
  ) {
    return a - b || x - y;
  }
}

Token.INITIAL_TOKEN = { token: new Token(DEFAULT_START_TTMP), order: 0 };
