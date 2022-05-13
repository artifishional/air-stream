/* <debug> */
import RedWSP from './wsp/rwsp.mjs';
/* </debug> */

export default class RedCon5ionHn {
  constructor(cb) {
    this.cb = cb;
  }

  reconnect(streams) {
    this.notRDYcounter = streams.length;
    this.streams = streams;
    // TODO: подозрительно, что здесь нигде не
    //  контролируется отписка
    //  очень похоже на то что здесь вместро streams
    //  должны накапливаться подключения к ним
    streams.forEach((stream) => stream.connect(this));
    // if zero streams length configuration
    if (!streams.length) {
      this.cb(this);
    }
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
