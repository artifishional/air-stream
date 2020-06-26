import RedWSPSlave from './rwsp-slave';

export default class WSPSchemaTuner {
  constructor({ whenAllRedConnected }, onrdy, ctr, proJ, tuner, async, conf) {
    this.tuner = tuner;
    this.conf = conf;
    this.proJ = proJ;
    this.async = async;
    this.ctr = ctr;
    this.onrdy = onrdy;
    this.wsp = null;
    this.whenAllRedConnected = whenAllRedConnected;
    this.ctr = ctr;
    this.tunedVer = 0;
    this.bags = [];
  }

  processCNF(cnf) {
    let isChanged = false;
    for (let i = 0; i < cnf.length; i += 1) {
      let box = cnf[i];
      if (!Array.isArray(box)) {
        // eslint-disable-next-line no-param-reassign
        box = [box, { on: true, key: -1 }];
      }
      const idx = this.bags.findIndex(([x]) => x === box[0]);
      if (idx > -1) {
        if (box.key !== -1) {
          this.bags[idx][1].key = box[1].key;
        } else {
          this.bags[idx][1].key = idx;
        }
        if (!box[1].on) {
          this.bags.splice(idx);
          isChanged = true;
        }
      } else {
        // eslint-disable-next-line no-lonely-if
        if (box[1].on) {
          this.bags.push(box);
          isChanged = true;
        }
      }
    }
    return isChanged;
  }

  add(streams) {
    this.setup(streams.map((stream) => [stream, { on: true, key: -1 }]));
  }

  setup(cnf) {
    if (!this.processCNF(cnf)) {
      return;
    }
    this.tunedVer += 1;
    const { tunedVer } = this;
    this.whenAllRedConnected(
      this.bags.map(([stream]) => stream),
      (bags) => {
        bags.forEach(([wsp, hook], idx) => {
          this.bags[idx][1].wsp = wsp;
          this.bags[idx][1].hook = hook;
        });
        if (tunedVer !== this.tunedVer) { return; }
        this.ctr.link(this);
        if (!this.wsp) {
          this.wsp = RedWSPSlave.extendedCombine(
            bags.map(([wsp]) => wsp),
            () => this.proJ,
            (wsp) => this.tuner(this, wsp.state.slice(-1)[0].value),
            this.conf,
          );
          this.onrdy(this.wsp);
        } else {
          this.wsp.setup(bags.map(([wsp]) => wsp));
        }
      },
    );
  }

  // не создавать промежуточных котнроллеров там,
  //  где они сохраниют прежний вид
  //  но оставлять возможность внедрять их в процессе
  handleCTR(req, data) {
    this.bags.forEach(([, { hook }]) => hook(req, data));
  }

  /**
   * @param {string|number} key
   */
  get(key) {
    const own = this;
    return {
      key,
      get value() {
        return own.bags[key][1].wsp.state.slice(-1)[0].value;
      },
      get src() {
        return own.bags[key][1].wsp;
      },
      get stream() {
        return own.bags[key][0];
      },
      get hook() {
        // TODO: may be unsubscribe checks is needed
        return (req, data) => queueMicrotask(
          () => own.bags[key][1].hook(req, data),
        );
      },
    };
  }
}