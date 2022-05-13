import { DEFAULT_START_TTMP } from './defs.mjs';
/* <debug> */ import Debug from './debug.mjs'; /* </debug> */

export default class Token
  /* <debug> */extends Debug/* </debug> */ {
  constructor(sttmp) {
    /* <debug> */
    super({ type: 'token' });
    /* </debug> */
    /**
     * Проверить, не создан ли уже текущий sttmp показатель
     * Если создан, то новый токен становится родственным текущему
     */
    this.sttmp = sttmp;
  }

  compromised() {
    return new Token(this.sttmp);
  }

  statusUpdate(sttmp) {
    const dt = sttmp - this.sttmp;
    this.sttmp = sttmp;
    return dt;
  }

  statusMove(dt) {
    this.sttmp += dt;
  }

  static compare(
    { token: { order: x, token: { sttmp: a } } },
    { token: { order: y, token: { sttmp: b } } },
  ) {
    return a - b || x - y;
  }
}

Token.INITIAL_TOKEN = { token: new Token(DEFAULT_START_TTMP), order: 0 };
