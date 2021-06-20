import { RedWSPSlave } from './wsp/rwsp';
import RedCon5ionHn from './red-connection-handler';
import AsyncTask from './async-task';

function arrEquals(arr1, arr2) {
  if (arr1.length !== arr2.length) {
    return false;
  }
  for (let i = 0; i < arr1.length; i += 1) {
    if (arr1[i] !== arr2[i]) {
      return false;
    }
  }
  return true;
}

export default class WSPSchemaTuner {
  constructor(
    _,
    onrdy,
    ctr,
    proJ,
    tuner = null,
    async = false,
    conf = {},
  ) {
    this.tuner = tuner;
    this.conf = conf;
    this.proJ = proJ;
    this.async = async;
    this.ctr = ctr;
    this.onrdy = onrdy;
    this.wsp = null;
    this.con5ionHnCTR = new RedCon5ionHn((bags) => this.con5ionHn(bags));
    this.ctr = ctr;
    this.bags = [];
    this.after5fullUpdateCTD = null;
  }

  processCNF(cnf) {
    let isChanged = false;
    for (let i = 0; i < cnf.length; i += 1) {
      let box = cnf[i];
      if (!Array.isArray(box)) {
        // eslint-disable-next-line
        box = [box, { on: true, key: -1, src: null, hook: null }];
      }
      const idx = this.bags.findIndex(([x]) => x === box[0]);
      if (idx > -1) {
        if (box.key !== -1) {
          this.bags[idx][1].key = box[1].key;
        } else {
          this.bags[idx][1].key = idx;
        }
        if (!box[1].on) {
          this.bags.splice(idx, 1);
          isChanged = true;
        }
      } else if (box[1].on) {
        this.bags.push(box);
        isChanged = true;
      }
    }
    return isChanged;
  }

  add(streams) {
    this.setup(streams.map((stream) => [stream, { on: true, key: -1 }]));
  }

  after5fullUpdateHn() {
    if (!this.after5fullUpdateCTD) {
      this.after5fullUpdateCTD = new AsyncTask(this.after5fullUpdateCTDrdy, this);
    }
  }

  after5fullUpdateCTDrdy() {
    this.after5fullUpdateCTD = null;
    this.tuner(this, this.wsp.getLastStateValue());
  }

  con5ionHn(con5ion) {
    con5ion.streams.forEach(({ wsp, hook }, idx) => {
      this.bags[idx][1].wsp = wsp;
      this.bags[idx][1].hook = hook;
    });
    if (!this.wsp) {
      this.ctr.link(this);
      this.wsp = RedWSPSlave.extendedCombine(
        con5ion.streams.map(({ wsp }) => wsp),
        () => this.proJ,
        this.tuner && this,
        this.conf,
      );
      this.onrdy(this.wsp);
    } else {
      this.wsp.setup(con5ion.streams.map(({ wsp }) => wsp));
    }
  }

  accurate(streams) {
    if (!arrEquals(this.bags.map(([x]) => x), streams)) {
      this.bags = streams.map(
        (box) => [box, {
          on: true, key: -1, src: null, hook: null,
        }],
      );
    }
    if (this.after5fullUpdateCTD) {
      this.after5fullUpdateCTD.cancel();
      this.after5fullUpdateCTD = null;
    }
    this.con5ionHnCTR.reconnect(this.bags.map(([stream]) => stream));
  }

  setup(cnf) {
    if (!this.processCNF(cnf)) {
      return;
    }
    if (this.after5fullUpdateCTD) {
      this.after5fullUpdateCTD.cancel();
      this.after5fullUpdateCTD = null;
    }
    this.con5ionHnCTR.reconnect(this.bags.map(([stream]) => stream));
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
        return own.bags[key][1].wsp.getLastStateValue();
      },
      get src() {
        return own.bags[key][1].wsp;
      },
      get stream() {
        return own.bags[key][0];
      },
      get hook() {
        // TODO: may be unsubscribe checks is needed
        return own.bags[key][1].hook;
      },
    };
  }
}
