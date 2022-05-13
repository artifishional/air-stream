import { EMPTY } from '../signals.mjs';
import STTMP from '../sync-ttmp-ctr';
import Propagate from '../propagate.mjs';
import { EMPTY_WSPS_LIST_4_COMBINED, STATIC_CREATOR_KEY } from '../defs.mjs';
import SyncEventManager from '../sync-man/sync-event-manager.mjs';
import SyncEventManagerSingle from '../sync-man/sync-event-manager-single.mjs';
/* <debug> */ import Debug from '../debug.mjs';/* </debug> */
import WSPSSetupResult from '../wrapper/wsps-setup-result.mjs';

let staticOriginWSPIDCounter = 0;

export default class WSP
  /* <debug> */extends Debug/* </debug> */ {
  /**
   * @param {Array.<WSP|RedWSP>|null} wsps Список источников входных данных
   * @param {*} conf
   * @param {Boolean} conf.configurable
   * @param {Object = undefined} creatorKey
   */
  constructor(
    wsps = null,
    conf = { },
    /* <debug> */ creatorKey, /* </debug> */
  ) {
    /* <debug> */
    super({ type: 'wsp' });
    /* </debug> */
    /* <debug> */
    this.debug.spreadInProgress = false;
    /* </debug> */
    /**
     * @type {Function}
     */
    this.hn = null;
    this.conf = conf;
    this.after5FullUpdateObs = null;
    /**
     * TODO: Источники тоже нужно выносить в инициализатор
     *  Так как теперь они могут изменяться в процессе
     *  Далее также использовать метод setup()
     */
    this.wsps = wsps;
    /* <debug> */
    if (creatorKey !== STATIC_CREATOR_KEY) {
      throw new TypeError('Only static constructor supported');
    }
    /* </debug> */
    /* <debug> */
    if (wsps) {
      if (wsps.some((wsp) => !(wsp instanceof WSP))) {
        throw new TypeError('Only WSP supported');
      }
    }
    /* </debug> */
    /**
     * @property {Set<WSP>}
     */
    this.slaves = new Set();
    /* <debug> */
    this.debug.$lastedRec = null;
    /* </debug> */
    this.curFrameCachedRecord = null;
    this.$originWSPs = null;
    this.$sncMan = null;
    if (!wsps) {
      staticOriginWSPIDCounter += 1;
      this.id = staticOriginWSPIDCounter;
    }
    // Уникальный номер блокировки, когда ожидается обновление конфигурации
    // Замок не блокирует работу всего узла, он только препятствует дальнейшее распотранение
    this.lockedState = null;
  }

  static get STATIC_LOCAL_WSP() {
    // eslint-disable-next-line no-use-before-define
    return STATIC_LOCAL_WSP;
  }

  /**
   * @returns {Map<WSP,Number>}
   * https://jsbench.me/79kc96qzol/1
   */
  reCalcOriginWSPs() {
    if (!this.wsps) {
      return new Map([
        [this, 1],
        [WSP.STATIC_LOCAL_WSP, 1],
      ]);
    }
    // Optimization for similar slaves
    if (
      this.wsps.length === 1
      && this.wsps[0].wsps
      && this.wsps[0].wsps.length === 1
      && !this.conf.configurable
    ) {
      return this.wsps[0].originWSPs;
    }
    return this.wsps
      .reduce((acc, { originWSPs }) => {
        // eslint-disable-next-line no-restricted-syntax
        for (const [key] of originWSPs) {
          acc.set(key, (acc.get(key) || 0) + 1);
        }
        return acc;
      }, this.conf.configurable ? new Map([[this, 0]]) : new Map());
  }

  createSyncEventMan() {
    if (!this.wsps || this.wsps.length < 2) {
      return new SyncEventManagerSingle(this);
    }
    return new SyncEventManager(this);
  }

  /**
   * Реакция на новую запись.
   *
   * @param cuR
   */
  handleR(cuR) {
    if (cuR.originWspUpdates) {
      this.toWSPSUpdate(cuR.originWspUpdates);
    }
    /* <debug> */
    if (!this.originWSPs.has(cuR.head.src)) {
      throw new Error('Original source not found for current record');
    }
    /* </debug> */
    this.sncMan.fill(cuR);
  }

  /**
   * Обновление источников событий.
   */
  toWSPSUpdate() {
    // TODO: Доступна оптимизация
    this.reCalcOriginWSPs();
  }

  sncGrpFilledHandler(updates) {
    const rec = this.createRecordFromUpdates(updates);

    if (rec) this.next(rec);
  }

  createRecordFromUpdates(updates) {
    const filtered = updates.filter(({ value }) => value !== EMPTY);
    if (!filtered.length) {
      return this.createRecordFrom(updates[0], EMPTY);
    }
    // Применить изменения
    const changes = this.hn(filtered);
    if (changes instanceof WSPSSetupResult) {
      this?.reConfigurate(changes.wsps);
      return null;
    }
    return this.createRecordFrom(filtered[0], changes);
  }

  with(hnProJ) {
    this.initiate(hnProJ);
  }

  cut(count, conf) {
    return WSP.create([this], () => {
      let ct = count;
      return ([{ value }]) => {
        if (value === EMPTY) {
          return EMPTY;
        }
        if (ct > 0) {
          ct -= 1;
          return EMPTY;
        }
        return value;
      };
    }, conf);
  }

  static merge(wsps, hnProJ, after5FullUpdateObs, conf = { }) {
    /** <debug>
     * Пустой список зависимостей на текущий момент
     *  допустИм только для данного оператора
     */
    if (!wsps.length) {
      // eslint-disable-next-line no-param-reassign
      wsps = EMPTY_WSPS_LIST_4_COMBINED;
    }
    /* </debug> */
    const res = new this(
      wsps,
      { ...conf, configurable: true },
      /* <debug> */ STATIC_CREATOR_KEY, /* </debug> */
    );
    res.initiate(hnProJ, after5FullUpdateObs);
    return res;
  }

  static extendedCombine(wsps, hnProJ, after5FullUpdateObs, {
    arrayOrObjectMode = true, ...conf
  } = { }) {
    /** <debug>
     * Пустой список зависимостей на текущий момент
     *  допустИм только для данного оператора
     */
    if (!wsps.length) {
      // eslint-disable-next-line no-param-reassign
      wsps = EMPTY_WSPS_LIST_4_COMBINED;
    }
    /* </debug> */
    const res = new this(
      wsps,
      { ...conf, configurable: true },
      /* <debug> */ STATIC_CREATOR_KEY, /* </debug> */
    );
    res.initiate((own) => {
      const combined = new Map(own.wsps.map((wsp) => [wsp, EMPTY]));
      // To keep the order of output
      // Исчтоники могут повторяться
      let awaitingFilling = combined.size;
      const proJ = hnProJ(own);
      return (updates) => {
        updates.forEach(({ src, value }) => {
          if (awaitingFilling) {
            if (combined.get(src) === EMPTY) {
              awaitingFilling -= 1;
            }
          }
          combined.set(src, value);
        });
        if (!awaitingFilling) {
          return proJ(
            arrayOrObjectMode
              ? own.wsps.map((wsp) => combined.get(wsp)) : Object.fromEntries(
                Object.entries(conf.streams).map(([key, { wsp }]) => [key, combined.get(wsp)]),
              ),
            arrayOrObjectMode ? updates
              : Object.fromEntries(updates.map(({ src, value }) => [combined.get(src), value])),
          );
        }
        return EMPTY;
      };
    }, after5FullUpdateObs);
    return res;
  }

  static extendedWithlatest(wsps, hnProJ, after5FullUpdateObs, conf = { }) {
    const res = new this(
      wsps,
      { ...conf, configurable: true },
      /* <debug> */ STATIC_CREATOR_KEY, /* </debug> */
    );
    res.initiate((own) => {
      // To keep the order of output
      let awaitingFilling = own.wsps.length;
      const combined = new Map(own.wsps.map((wsp) => [wsp, EMPTY]));
      const proJ = hnProJ(own);
      return (updates) => {
        updates.forEach(({ src, value }) => {
          if (awaitingFilling) {
            if (combined.get(src) === EMPTY) {
              awaitingFilling -= 1;
            }
          }
          combined.set(src, value);
        });
        if (!awaitingFilling && updates.some(({ src }) => src === wsps[0])) {
          return proJ([...combined.values()], updates);
        }
        return EMPTY;
      };
    }, after5FullUpdateObs);
    return res;
  }

  get sncMan() {
    if (!this.$sncMan) {
      this.$sncMan = this.createSyncEventMan();
    }
    return this.$sncMan;
  }

  get originWSPs() {
    if (!this.$originWSPs) {
      this.$originWSPs = this.reCalcOriginWSPs();
    }
    return this.$originWSPs;
  }

  updateWSPs(wsps) {
    this.wsps = wsps;
  }

  after5FullUpdateHn() {
    if (this.after5FullUpdateObs?.after5fullUpdateHn) {
      this.after5FullUpdateObs.after5fullUpdateHn(this);
    }
  }

  /**
   * @param {Function|null = null} hnProJ
   * @param {{after5FullUpdateHn?: Function,after5FullUpdateHn?: Function}|null} after5FullUpdateObs
   */
  initiate(hnProJ, after5FullUpdateObs = null) {
    if (hnProJ) {
      this.hn = hnProJ(this);
      /* <debug> */
      if (typeof this.hn !== 'function') {
        throw new TypeError('The hnProJ call must return a function');
      }
      /* </debug> */
    }
    this.after5FullUpdateObs = after5FullUpdateObs;
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

  static create(wsps = null, hnProJ = null, conf = {}) {
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

  static fromCbFunc(cb, conf) {
    const res = WSP.create(null, null, conf);
    cb((data) => res.burn(data));
    return res;
  }

  static fromFn(fn) {
    const res = WSP.create();
    res.burn(fn());
    return res;
  }

  createRecordFrom(rec, updates) {
    return rec.from(updates, this);
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
    if (this.curFrameCachedRecord
      && this.curFrameCachedRecord[0].token.token === STTMP.get().token
    ) {
      this.curFrameCachedRecord.map((cuR) => slv.handleR(cuR));
    } else {
      this.curFrameCachedRecord = null;
    }
    this.slaves.add(slv);
  }

  get(proJ) {
    return WSP.create([this],
      () => ([update]) => {
        proJ(update);
        return update;
      });
  }

  next(rec) {
    /**
     * Следующее не совсем верно
     *   Сначала должна произойти рассылка сообщений
     *   так как иначе, добавленный во время рассылки уезел
     *   получит сообщение из рассылки и из потоврителя curFrameCachedRecord
     *  так как узел может начать подписку уже после завершения подписки, но до того
     *  как закончится рассылка
     *  Здесь важным является только защита от накопления подписчиков
     *   во время дейстующей рассылки
     *
     */
    if (!this.curFrameCachedRecord
      || this.curFrameCachedRecord[0].token.token !== rec.token.token
    ) {
      this.curFrameCachedRecord = [];
    }
    this.curFrameCachedRecord.push(rec);
    if (this.after5UpdateHn() || this.lockedState) {
      return;
    }
    /* <debug> */
    this.debug.spreadInProgress = true;
    /* </debug> */
    [...this.slaves].forEach((slv) => {
      // Если подписчик удяляется во время подписки
      if (this.slaves.has(slv)) {
        slv.handleR(rec);
      }
    });
    /* <debug> */
    this.debug.spreadInProgress = false;
    /* </debug> */
    this.after5FullUpdateHn();
    // При необходимости оптимизации можно перенять механику от
    // Event с жестко контролируемой через idx рассылкой
  }

  after5UpdateHn() {
    if (this.after5FullUpdateObs?.after5UpdateHn) {
      return this.after5FullUpdateObs.after5UpdateHn(this);
    }
    return false;
  }

  /**
   * Конструктор новых событий (handle)
   * @param value
   * @param token
   */
  burn(value, token = STTMP.get()) {
    /* <debug> */
    if (this.debug.$lastedRec) {
      if (token.token === this.debug.$lastedRec.token.token
        || this.debug.$lastedRec.token.token.sttmp >= token.token.sttmp
      ) {
        throw new Error(`
        More than one event at a time for the current source
        current value is: ${value}
        lasted value is: ${this.debug.$lastedRec.value}
      `);
      }
    }
    /* </debug> */
    const rec = Propagate.burn(value, token, this);
    /* <debug> */
    this.debug.$lastedRec = rec;
    /* </debug> */
    this.next(rec);
  }

  map(proJ, conf) {
    return WSP.create(
      [this], () => ([value]) => proJ(value), conf,
    );
  }

  filter(proJ, conf) {
    return WSP.create(
      [this],
      () => ([update]) => (proJ(update) ? update.value : EMPTY),
      conf,
    );
  }
}

const STATIC_LOCAL_WSP = WSP.create();

/* <debug> */
// eslint-disable-next-line no-undef
globalThis.WSP = WSP;
/* </debug> */
