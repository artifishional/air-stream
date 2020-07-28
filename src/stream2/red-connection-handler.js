/* <debug> */
import RedWSP from './wsp/rwsp.js';
/* </debug> */

export default class RedCon5ionHn {
  constructor(cb) {
    this.cb = cb;
  }

  reconnect(streams) {
    this.notRDYcounter = streams.length;
    this.streams = streams;
    streams.map((stream) => stream.connect(this));
  }

  hn(stream) {
    /* <debug> */
    if (!(stream.wsp instanceof RedWSP)) {
      throw new TypeError('WSP layers are not supported. '
        + 'Pls use store for preliminary transformation.');
    }
    /* </debug> */
    this.notRDYcounter -= 1;
    if (!this.notRDYcounter) {
      this.cb(this);
    }
  }
}
