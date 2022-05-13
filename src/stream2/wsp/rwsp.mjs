import WSP from './wsp.mjs';
import ReT4 from '../retouch/retouch.mjs';
import { RET4_TYPES } from '../retouch/retouch-types.mjs';
import { EMPTY } from '../signals.mjs';
import HeadRecord from '../record/head-record.mjs';
import Token from '../token';
import STTMP from '../sync-ttmp-ctr';
import { STATIC_GETTERS } from '../defs.mjs';
import * as utils from '../../utils';

export const DEFAULT_MSG_ALIVE_TIME_MS = 3000;
export const DEFAULT_UPDATE_T4_STATUS_CTD_VALUE = 10;

/**
 * @readonly
 * @enum {number}
 */
export const RED_WSP_SUBORDINATION = {
  MASTER: 'MASTER',
  SLAVE: 'SLAVE',
};

/**
 * @readonly
 * @enum {number}
 */
export const RED_WSP_LOCALIZATION = {
  LOCAL: 'LOCAL',
  REMOTE: 'REMOTE',
};

export default class RedWSP extends WSP {
  static get SUBORDINATION() {
    return RED_WSP_SUBORDINATION;
  }

  /**
  * @param {Array.<WSP|RedWSP>|null} wsps Список источников входных данных
  * Для мастера может быть только один источник
  * null - если это головной узел
  * @param {Boolean = false} Reinit getter when reT4
  * @param {RED_WSP_SUBORDINATION} subordination
  * @param {*} initialValue
  *   Видимо ведет себя по разному:
   *   для зависимых - не создает новое сообщение, а только предоставляет
   *    локальное постоянное обвноялемое значение
   *   и только для местных головных - создает новое значение в момент
   *    инциализации
   * @param {STATIC_CREATOR_KEY} creatorKey
   * @param args
  */
  constructor(wsps, {
    subordination = RED_WSP_SUBORDINATION.MASTER,
    initialValue = EMPTY,
    onReT4completeCb = null,
    ...args
  } = {}, /* <debug> */ creatorKey /* </debug> */) {
    /* <debug> */
    if (wsps && !wsps.length) {
      throw new TypeError('Unsupported empty list of wsps');
    }
    /* </debug> */
    super(wsps, args, /* <debug> */ creatorKey /* </debug> */);
    this.onRDY = args?.onRDY || null;
    this.initialValue = initialValue;
    this.incompleteRet4 = null;
    this.subordination = subordination;
    this.state = null;
    this.hnProJReT4 = null;
    /* <debug> */
    this.debug.reT4SpreadInProgress = false;
    /* </debug> */
    this.$updateT4statusCTD = this.constructor.UPDATE_T4_STATUS_CTD_VALUE;
    this.onReT4completeCb = onReT4completeCb;
    this.reT4NotFinalized = false;
    /**
     * Прекратить обновление и начать реконфигурацию
     * @type {RedWSP[]}
     */
    this.abortAndSetup = null;
  }

  static get MSG_ALIVE_TIME_MS() {
    return this.$MSG_ALIVE_TIME_MS;
  }

  static set MSG_ALIVE_TIME_MS(value) {
    this.$MSG_ALIVE_TIME_MS = value;
  }

  static get UPDATE_T4_STATUS_CTD_VALUE() {
    return this.$UPDATE_T4_STATUS_CTD_VALUE;
  }

  static set UPDATE_T4_STATUS_CTD_VALUE(value) {
    this.$UPDATE_T4_STATUS_CTD_VALUE = value;
  }

  initiate(hnProJ, after5FullUpdateObs) {
    this.hnProJReT4 = hnProJ;
    if (this.subordination === RED_WSP_SUBORDINATION.MASTER) {
      this.state = [];
      if (this.initialValue !== EMPTY) {
        this.next(this.createRecordFrom(
          new HeadRecord(
            null,
            Token.INITIAL_TOKEN,
            this.constructor.STATIC_LOCAL_WSP,
          ),
          this.initialValue,
        ));
      }
      /* else {
         Немедленная инициализация из очереди wsp
      } */
      super.initiate(hnProJ, after5FullUpdateObs);
    } else {
      // to prevent W initiate hn
      super.initiate(null, after5FullUpdateObs);
    }
  }

  toJSON() {
    return {
      id: this.debug.id,
      species: this.constructor.name,
      configurable: this.conf.configurable,
      state: this.state.map((rec) => rec.toJSON()),
      children: [...this.slaves].map((slave) => slave.toJSON()),
    };
  }

  after5FullUpdateHn() {
    if (!this.incompleteRet4) {
      super.after5FullUpdateHn();
    }
  }

  after5UpdateHn() {
    if (!this.incompleteRet4) {
      return super.after5UpdateHn();
    }
    return false;
  }

  getLockedState() {
    this.lockedState = {};
    return this.lockedState;
  }

  get(proJ) {
    return this.constructor[Symbol.species].create([this],
      () => ([update]) => {
        proJ(update);
        return update;
      });
  }

  // TODO: Only for master RWSP
  reCalcOriginWSPs() {
    const wsps = super.reCalcOriginWSPs();
    if (this.subordination === RED_WSP_SUBORDINATION.MASTER) {
      wsps.set(this, 1);
    }
    return wsps;
  }

  factory(construct, getter = STATIC_GETTERS.STRAIGHT, equal = utils.equal) {
    const cache = new Map();
    return this.constructor[Symbol.species].create([this],
      () => ([update]) => getter(update.value).map((raw) => {
        let exst = utils.findFromMap(cache, ([x]) => equal(x, raw));
        if (!exst) {
          exst = [raw, construct(raw /* , source mapper */)];
          cache.set(raw, exst[1]);
        }
        return exst[1];
      }));
  }

  reconstruct() {
    /* <debug> */
    if (this.$sncMan?.sncLastEvtGrp) {
      throw new Error('Unexpected model state');
    }
    /* </debug> */
    this.$originWSPs = null;
    this.$sncMan = null;
    this.slaves.forEach((slave) => slave.reconstruct());
  }

  /**
   * Начать обновление схемы родительских потоков
   * @param {RedWSP[]} wsps
   * @param {{}} locked
   */
  reConfigurate(wsps, locked) {
    if (this.lockedState !== locked) {
      return;
    }
    this.lockedState = null;
    if (this.incompleteRet4) {
      this.abortAndSetup = wsps;
    } else {
      this.setup(wsps);
    }
  }

  setup(wsps) {
    /* <debug> */
    if (this.debug.reT4SpreadInProgress) {
      throw new Error('Unexpected model state');
    }
    if (this.incompleteRet4) {
      throw new Error('Unexpected model state');
    }
    if (this.debug.spreadInProgress) {
      throw new Error('Unexpected model state');
    }
    if (!this.conf.configurable) {
      throw new Error('Only configurable stream are supported for setup');
    }
    if (!wsps || !wsps.length) {
      throw new Error('Unsupported configuration');
    }
    /* </debug> */
    this.wsps
      .filter((wsp) => !wsps.includes(wsp))
      .forEach((wsp) => wsp.off(this));
    // reconstruct по сути только для WSP узлов
    // RED сделают это на базе reT4 reconstruct
    // TODO: Temporary solution
    this.$originWSPs = null;
    // TODO: Temporary solution
    this.updateWSPs(wsps);
    // TODO: Temporary solution
    this.reconstruct();
    this.subscription();
  }

  // TODO: Temporary solution
  updateWSPs(wsps) {
    super.updateWSPs(wsps);
    this.beginReT4(RET4_TYPES.ReCONSTRUCT, { origin: this, wsps });
  }

  /**
   * Обработчик нового события от внешнего источника
  * Источники:
  * 1. Данные дополенения от текущего удаленного хранилища (в рамках моста)
  *    - Статус подтвержден
  *    - Пересчет позиций
  *    - Владельцем является текущий store
  * 2. Данные от потоков контроллера
  *    - Должны быть превращены в red master record с запросом на подтверждение
  *    - Статус не подтвержден
  *    - Владелец внешний
  * 3. Данные от соседнего ВНЕШНЕГО хранилища
  *    - Статус любой
  *    Соседний store
  *    может получать новые данные от контроллера,
  *    может также быть восстановлен готовыми данными с сервера.
  *    - Пересчет позиций
  *    - Владелец внешний
  * 4. Данные от соседнего ВНУТРЕННЕГО хранилища
  *    - Являются для данного типа аналогом данных от потоков контроллера
  *    Как различать тип хранилища?
  */

  get isInitialized() {
    return !!this.state.length;
  }

  next(rec) {
    if (!this.isInitialized && rec.value === EMPTY) {
      return;
    }
    this.pushToState(rec);
    if (this.after5UpdateHn() || this.lockedState) {
      return;
    }
    if (!this.incompleteRet4) {
      // TODO: super.next(rec); after curFrameCachedRecord resolution
      // To prevent adding a subscriber while broadcasting
      [...this.slaves].forEach((slv) => slv.handleR(rec));
    }
    // TODO: не полное решение
    // есть ли необходисоть дергать апдейтер до того как заврешился тач?
    // и если нет, то как избежать пустых сообщений
    if (rec.value !== EMPTY) {
      this.after5FullUpdateHn();
    }
  }

  beginReT4(type, prms) {
    // TODO: W reconstruct hn when init
    this.hn = this.hnProJReT4(this);
    this.incompleteRet4 = ReT4.create(this, type, prms);
  }

  /**
   * @param rwsp
   * @param {Array.<Record>} reT4data
   * @param {RET4_TYPES} type
   * @param {{merge: boolean}} prms abstract config
   */
  handleReT4(rwsp, reT4data, type, prms) {
    if (!this.incompleteRet4) {
      this.beginReT4(type, prms);
    }
    this.incompleteRet4.fill(rwsp, reT4data);
    // не требуются дополнительные усилия за контролем над устарешвей очередью
    // в случае ошибки - головная запись будет иметь соответсвтующий статус
    // в случае восстановления - все предыдущие действия уже должны будут завершиться
    // так как работа идет только в синхронном режиме
    // полное открытие просиходит тогда, когда удается разместить все
    // данные из смежных состояний
  }

  onReT4Complete({ prms }, updates) {
    // TODO: need refactor
    //  'updates' processing is needed in polymorphic form
    if (this.subordination === this.constructor.SUBORDINATION.MASTER
      && !prms.merge
    ) {
      this.state.length = 1;
      const idx = updates.findIndex(
        (rec) => Token.compare(rec, this.state[0]) < 0,
      );
      // eslint-disable-next-line no-param-reassign
      updates = idx > -1 ? updates.slice(idx) : [];
    } else if (prms.merge) {
      const idx = this.state.findIndex(
        (rec) => Token.compare(rec, prms.merge) >= 0,
      );
      this.state.splice(idx, Infinity);
    } else {
      this.state = [];
    }
    // Так как во время reT4 мы сейчас имеем шанс получить обновление
    this.$sncMan = null;
    updates.some((rec) => {
      this.handleR(rec);
      return this.abortAndSetup;
    });
    if (this.abortAndSetup) {
      this.incompleteRet4.cancel();
      this.incompleteRet4 = null;
      this.$sncMan = null;
      const { abortAndSetup } = this;
      this.abortAndSetup = null;
      this.setup(abortAndSetup);
      return;
    }
    if (this.sncMan.sncLastEvtGrp) {
      this.reT4NotFinalized = true;
    } else {
      this.finalizeReT4(this.incompleteRet4);
    }
  }

  finalizeReT4({ prms, type }) {
    this.incompleteRet4 = null;
    if (this.after5UpdateHn() || this.lockedState) {
      return;
    }
    this.reT4NotFinalized = false;
    /* <debug> */
    if (!this.isInitialized) {
      throw new Error('Unexpected model state');
    }
    /* </debug> */
    /* <debug> */
    this.debug.reT4SpreadInProgress = true;
    /* </debug> */
    this.slaves.forEach((rwsp) => rwsp.handleReT4(
      this, this.state, type, prms,
    ));
    /* <debug> */
    this.debug.reT4SpreadInProgress = false;
    /* </debug> */
    this.after5FullUpdateHn();
    this.onRDY?.(this);
    if (this.onReT4completeCb) {
      this.onReT4completeCb(this);
      this.onReT4completeCb = null;
    }
  }

  sncGrpFilledHandler(updates) {
    super.sncGrpFilledHandler(updates);
    if (this.reT4NotFinalized && !this.sncMan.sncLastEvtGrp) {
      this.finalizeReT4(this.incompleteRet4);
    }
  }

  /**
   * @param {WSP} slv
   */
  on(slv) {
    /* <debug> */
    if (!(slv instanceof this.constructor[Symbol.species])
      && !('binding' in slv)
      && !('handleReT4' in slv)
    ) {
      throw new Error('Unsupported configuration');
    }
    /* </debug> */
    /* <debug> */
    if (!this.state.length) {
      throw new Error('Unexpected model state');
    }
    /* </debug> */
    /**
     * TODO: may be duplicate users
     */
    this.updateT4status();
    slv.handleReT4(this, this.state, RET4_TYPES.ReINIT);
    /**
     * TODO: опустошение очереди
     */
    this.curFrameCachedRecord = null;
    super.on(slv);
  }

  findIndexOfLastRelUpdate() {
    const relTTMP = STTMP.get().token.sttmp
      - this.constructor.MSG_ALIVE_TIME_MS;
    let startAt = this.state.length - 1;
    if (this.state[startAt].value === EMPTY) {
      startAt -= 1;
    }
    // eslint-disable-next-line no-plusplus
    for (let i = startAt; i--;) {
      const rec = this.state[i];
      if (rec.token.token.sttmp < relTTMP) {
        return i;
      }
    }
    return 0;
  }

  pushToState(rec) {
    const lastStateIDX = this.state.length - 1;
    if (lastStateIDX > -1 && this.state[lastStateIDX].value === EMPTY) {
      this.state[lastStateIDX] = rec;
      return;
    }
    this.state.push(rec);
    this.updateT4statusCTD();
  }

  updateT4statusCTD() {
    this.$updateT4statusCTD -= 1;
    if (!this.$updateT4statusCTD) {
      this.$updateT4statusCTD = this.constructor.UPDATE_T4_STATUS_CTD_VALUE;
      this.updateT4status();
    }
  }

  getLastStateValue() {
    const last = this.getLastState();
    if (last) {
      return last.value;
    }
    return EMPTY;
  }

  getLastState() {
    if (!this.state.length) {
      return undefined;
    }
    return this.state.findLast(({ value }) => value !== EMPTY);
  }

  updateT4status() {
    const lastRelUpdateIdx = this.findIndexOfLastRelUpdate();
    if (lastRelUpdateIdx) {
      this.state = this.state.slice(lastRelUpdateIdx);
    }
  }

  map(proJ, conf) {
    return this.constructor[Symbol.species].create([this],
      () => ([value]) => proJ(value), conf);
  }

  distinct(equal, conf) {
    return this.constructor[Symbol.species].create([this],
      () => {
        let state = EMPTY;
        return ([{ value }]) => {
          if (value === EMPTY) {
            return EMPTY;
          }
          if (state !== EMPTY && equal(state, value)) {
            return EMPTY;
          }
          state = value;
          return state;
        };
      }, conf);
  }

  static [Symbol.species] = this;
}

RedWSP.$MSG_ALIVE_TIME_MS = RedWSP.$MSG_ALIVE_TIME_MS
  || DEFAULT_MSG_ALIVE_TIME_MS;
RedWSP.$UPDATE_T4_STATUS_CTD_VALUE = RedWSP.$UPDATE_T4_STATUS_CTD_VALUE
  || DEFAULT_UPDATE_T4_STATUS_CTD_VALUE;
