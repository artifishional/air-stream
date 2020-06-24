import { DEFAULT_TOKEN, EMPTY } from './signals';
import STTMP from './sync-ttmp-ctr';
import Record from './record/record';
import Propagate from './propagate';
import { STATIC_CREATOR_KEY } from './defs';
import SyncEventManager from './sync-event-manager';
import SyncEventManagerSingle from './sync-event-manager-single';

let staticOriginWSPIDCounter = 0;

const UNIQUE_MINOR_VALUE = Object.freeze({
  /* <debug> */
  UNIQUE_MINOR_VALUE: 'UNIQUE_MINOR_VALUE',
  /* </debug> */
});

export default class WSP {
  /**
   * @param {Array.<WSP|RedWSP>|null} wsps Список источников входных данных
   * @param {*} conf
   * @param {Object = undefined} creatorKey
   */
  constructor(
    wsps = null,
    conf = {},
    /* <debug> */ creatorKey, /* </debug> */
  ) {
    /**
     * @type {Function}
     */
    this.hn = null;
    this.conf = conf;
    if (!wsps) {
      staticOriginWSPIDCounter += 1;
      this.id = staticOriginWSPIDCounter;
    }
    this.$after5FullUpdateHn = null;
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
    this.$lastedMinorValue = UNIQUE_MINOR_VALUE;
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

  cut(count) {
    return WSP.create([this], () => {
      let ct = count;
      return ([{ value }]) => {
        if (ct > 0) {
          ct -= 1;
          return EMPTY;
        }
        return value;
      };
    });
  }

  static combine(wsps, proJ, conf = {}) {
    const res = new this(
      wsps,
      conf,
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

  static extendedCombine(wsps, hnProJ, after5FullUpdateHn, conf = {}) {
    const res = new this(
      wsps,
      conf,
      /* <debug> */ STATIC_CREATOR_KEY, /* </debug> */
    );
    res.initiate((own) => {
      const combined = new Map();
      const proJ = hnProJ(own);
      return (updates) => {
        updates.forEach(({ src, value }) => combined.set(src, value));
        if (combined.size === res.wsps.length) {
          return proJ([...combined.values()], updates);
        }
        return EMPTY;
      };
    }, after5FullUpdateHn);
    return res;
  }

  setup(wsps) {
    // обновить список текущих потоков
    this.wsps = wsps;
    /*
    // пересчитать список источников
    // список источников не может меняться в синхронной версии
    let originWSpS = null;
    if (!wsps) {
      originWSpS = [this];
    } else {
      originWSpS = [...new Set(wsps.map(({ originWSpS }) => originWSpS).flat(1))];
    }
    */
    // выполнить reT4

    this.subscription();
  }

  // eslint-disable-next-line class-methods-use-this
  $(data) {
    this.$lastedMinorValue = data;
    return data;
  }

  after5FullUpdateHn() {
    if (this.$after5FullUpdateHn) {
      this.$after5FullUpdateHn(this);
    }
  }

  /**
   * @param {Function|null = null} hnProJ
   * @param {Function|null = null} after5FullUpdateHn
   */
  initiate(hnProJ, after5FullUpdateHn = null) {
    if (hnProJ) {
      this.hn = hnProJ(this);
    }
    this.$after5FullUpdateHn = after5FullUpdateHn;
    this.subscription();
  }

  subscription() {
    if (this.wsps) {
      this.wsps.forEach((wsp) => wsp.on(this));
    }
  }

  kill() {
    // TODO: mb debug only func?
    if (this.wsps) {
      this.wsps.forEach((wsp) => wsp.off(this));
    }
  }

  static create(wsps, hnProJ = null, conf = {}) {
    const res = new this(
      wsps,
      conf,
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
    /**
     * Сначала должна произойти рассылка сообщений
     * так как иначе, добавленный во время рассылки уезел
     * получит сообщение из рассылки и из потоврителя curFrameCachedRecord
     * TODO: требуется тест подписка на узел во время рассылки
     */
    this.slaves.forEach((slv) => slv.handleR(this, rec));
    if (!this.curFrameCachedRecord) {
      this.curFrameCachedRecord = [];
    }
    this.curFrameCachedRecord.push(rec);
    this.after5FullUpdateHn();
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

  map(proJ, conf) {
    return WSP.create(
      [this], () => ([value]) => proJ(value), conf
    );
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
