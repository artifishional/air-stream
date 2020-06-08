import { DEFAULT_TOKEN, EMPTY } from './signals';
import STTMP from './sync-ttmp-ctr';
import Record from './record/record';
import Propagate from './propagate';
import { STATIC_CREATOR_KEY } from './defs';
import SyncEventManager from './sync-event-manager';
import SyncEventManagerSingle from './sync-event-manager-single';

let staticOriginWSPIDCounter = 0;

export default class WSP {
  /**
   * @param {Array.<WSP|RedWSP>|null} wsps Список источников входных данных
   * @param {*} args
   * @param {Object = undefined} creatorKey
   */
  constructor(
    wsps = null,
    args = {},
    /* <debug> */ creatorKey, /* </debug> */
  ) {
    this.args = args;
    if (!wsps) {
      staticOriginWSPIDCounter += 1;
      this.id = staticOriginWSPIDCounter;
    }
    this.wsps = wsps;
    /* <debug> */
    if (creatorKey !== STATIC_CREATOR_KEY) {
      throw new TypeError('Only static constructor supported');
    }
    /* </debug> */
    /* <debug> */
    if (wsps) {
      if (wsps.some((stream) => !(stream instanceof WSP))) {
        throw new TypeError('Only WSP supported');
      }
    }
    /* </debug> */
    /**
     * @property {Set<WSP>}
     */
    this.slaves = new Set();
    this.hnProJ = null;
    this.lastedstoken = DEFAULT_TOKEN;
    this.curFrameCachedRecord = null;
    if (!wsps) {
      this.originWSpS = [this];
    } else {
      this.originWSpS = [...new Set(wsps.map(({ originWSpS }) => originWSpS).flat(1))];
    }
    /* <debug> */
    if (this.originWSpS.some((wsp) => !(wsp instanceof WSP))) {
      throw new TypeError();
    }
    /* </debug> */
    this.sncMan = this.createSyncEventMan();
  }

  static get STATIC_LOCAL_WSP() {
    // eslint-disable-next-line no-use-before-define
    return STATIC_LOCAL_WSP;
  }

  createSyncEventMan() {
    if (!this.wsps || this.wsps.length < 2) {
      return new SyncEventManagerSingle(this);
    }
    return new SyncEventManager(this);
  }

  handleR(src, cuR) {
    this.sncMan.fill(src, cuR);
  }

  sncGrpFilledHandler(updates) {
    this.next(this.createRecordFromUpdates(updates));
  }

  createRecordFromUpdates(updates) {
    const filtered = updates.filter(({ value }) => value !== EMPTY);
    if (!filtered.length) {
      return this.createRecordFrom(updates[0], EMPTY);
    }
    return this.createRecordFrom(filtered[0], this.hn(filtered));
  }

  with(hnProJ) {
    this.initiate(hnProJ);
  }

  static combine(wsps, proJ) {
    const res = new this(
      wsps,
      {},
      /* <debug> */ STATIC_CREATOR_KEY, /* </debug> */
    );
    res.initiate(() => {
      const combined = new Map();
      return (updates) => {
        updates.forEach(({ src, value }) => combined.set(src, value));
        if (combined.size === wsps.length) {
          return proJ([...combined.values()]);
        }
        return EMPTY;
      };
    });
    return res;
  }

  /**
   * @param {Function|null = null} hnProJ
   */
  initiate(hnProJ) {
    this.hnProJ = hnProJ;
    if (!this.hn && this.hnProJ) {
      this.hn = this.hnProJ(this);
    }
    if (this.wsps) {
      this.wsps.map((stream) => stream.on(this));
    }
  }

  static create(wsps, hnProJ = null, args = {}) {
    const res = new this(
      wsps,
      args,
      /* <debug> */ STATIC_CREATOR_KEY, /* </debug> */
    );
    if (hnProJ) {
      res.initiate(hnProJ);
    }
    return res;
  }

  static fromCbFunc(cb) {
    const res = WSP.create();
    cb((data) => res.burn(data));
    return res;
  }

  static fromFn(fn) {
    const res = WSP.create();
    res.burn(fn());
    return res;
  }

  createRecordFrom(rec, updates) {
    return rec.from(updates, Record, undefined, this);
  }

  off(slv) {
    this.slaves.delete(slv);
  }

  /**
   * @param {WSP} slv
   */
  on(slv) {
    // TODO: Записи придут одна за другой от разных handler,
    //  но одного controller
    if (this.curFrameCachedRecord && this.curFrameCachedRecord[0].token === STTMP.get()) {
      this.curFrameCachedRecord.map((cuR) => slv.handleR(this, cuR));
    } else {
      this.curFrameCachedRecord = null;
    }
    this.slaves.add(slv);
  }

  get(proJ) {
    return WSP.create([this],
      () => ([[update]]) => {
        proJ(update);
        return update;
      });
  }

  next(rec) {
    if (!this.curFrameCachedRecord) {
      this.curFrameCachedRecord = [];
    }
    this.curFrameCachedRecord.push(rec);
    this.slaves.forEach((slv) => slv.handleR(this, rec));
  }

  /**
   * Конструктор новых событий (handle)
   * @param value
   * @param token
   */
  burn(value, token = STTMP.get()) {
    /* <debug> */
    if (token === this.lastedstoken || this.lastedstoken.sttmp >= token.sttmp) {
      throw new Error('More than one event at a time for the current source');
    }
    this.lastedstoken = token;
    /* </debug> */
    this.next(Propagate.burn(value, token, this));
  }

  map(proJ) {
    return WSP.create([this],
      () => ([value]) => proJ(value));
  }

  filter(proJ) {
    return WSP.create(
      [this],
      () => ([update]) => (proJ(update) ? update.value : EMPTY),
    );
  }
}

const STATIC_LOCAL_WSP = WSP.create();

/* <debug> */
// eslint-disable-next-line no-undef
globalThis.WSP = WSP;
/* </debug> */
