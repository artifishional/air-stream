import ReT4 from './retouch-base';


export default class ReT4Abort extends ReT4 {
  constructor(src) {
    super(src);
    this.acc = new Map();
  }

  fill(rwsp, reT4Data) {
    this.acc.set(rwsp, reT4Data);
    if (this.acc.size === this.src.streams.length) {
      this.src.onReT4Complete(this.acc);
    }
  }
}
