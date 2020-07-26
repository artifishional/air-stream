import WSP from './wsp';
import ReT4 from '../retouch/retouch';
import { RET4_TYPES } from '../retouch/retouch-types';
import { EMPTY } from '../signals';
import HeadRecord from '../record/head-record';
import Token from '../token';
// eslint-disable-next-line import/no-cycle
import RedWSPSlave from './rwsp-slave';
import Record from '../record/record';
import STTMP from '../sync-ttmp-ctr';

const DEFAULT_MSG_ALIVE_TIME_MS = 3000;
const UPDATE_T4_STATUS_CTD_COUNTER = 10;

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

  static get LOCALIZATION() {
    return RED_WSP_LOCALIZATION;
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
    ...args
  } = {}, /* <debug> */ creatorKey /* </debug> */) {
    super(wsps, args, /* <debug> */ creatorKey /* </debug> */);
    this.initialValue = initialValue;
    this.incompleteRet4 = null;
    this.subordination = subordination;
    this.state = null;
    this.hnProJReT4 = null;
    /* <debug> */
    this.debug.reT4SpreadInProgress = false;
    /* </debug> */
    this.$updateT4statusCTD = UPDATE_T4_STATUS_CTD_COUNTER;
  }

  initiate(hnProJ, after5FullUpdateObs) {
    this.hnProJReT4 = hnProJ;
    if (this.subordination === RED_WSP_SUBORDINATION.MASTER) {
      this.state = [];
      if (this.initialValue !== EMPTY) {
        this.next(new HeadRecord(
          null,
          this,
          null,
          Token.INITIAL_TOKEN,
          undefined,
          this.constructor.STATIC_LOCAL_WSP,
        ).from(this.initialValue, Record, this, this));
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

  get(proJ) {
    return RedWSPSlave.create([this],
      () => ([update]) => {
        proJ(update);
        return update;
      });
  }

  reconstruct() {
    /* <debug> */
    if (this.$sncMan && this.$sncMan.sncLastEvtGrp) {
      throw new Error('Unexpected model state');
    }
    /* </debug> */
    this.$originWSPs = null;
    this.$sncMan = null;
    this.slaves.forEach((slave) => slave.reconstruct());
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

  next(rec) {
    if (!this.state.length && rec.value === EMPTY) {
      return;
    }
    this.pushToState(rec);
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

  onReT4Complete({ prms, type }, updates) {
    if (prms.merge) {
      const idx = this.state.findIndex(
        (rec) => Token.compare(rec, prms.merge) >= 0,
      );
      this.state.splice(idx, Infinity);
    } else {
      this.state = [];
    }
    updates.forEach((rec) => this.handleR(rec));
    /* <debug> */
    if (this.sncMan.sncLastEvtGrp) {
      throw new Error('Unexpected model state');
    }
    /* </debug> */
    /* <debug> */
    if (!this.state.length) {
      throw new Error('Unexpected model state');
    }
    /* </debug> */
    this.incompleteRet4 = null;
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
  }

  createRecordFrom(rec, updates) {
    return rec.from(
      updates,
      Record,
      undefined,
      this,
    );
  }

  /**
   * @param {RedWSPSlave} slv
   */
  on(slv) {
    /* <debug> */
    if (!(slv instanceof RedWSPSlave)) {
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
    const relTTMP = STTMP.get().token.sttmp - DEFAULT_MSG_ALIVE_TIME_MS;
    let startAt = this.state.length - 1;
    if (this.state[startAt].value === EMPTY) {
      startAt -= 1;
    }
    // eslint-disable-next-line no-plusplus
    for (let i = startAt; i--;) {
      const rec = this.state[i];
      if (rec.token.token.sttmp < relTTMP) {
        return i + 1;
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
      this.$updateT4statusCTD = UPDATE_T4_STATUS_CTD_COUNTER;
      this.updateT4status();
    }
  }

  getLastStateValue() {
    const lastStateIDX = this.state.length - 1;
    if (this.state[lastStateIDX].value === EMPTY) {
      return this.state[lastStateIDX - 1].value;
    }
    return this.state[lastStateIDX].value;
  }

  updateT4status() {
    const lastRelUpdateIdx = this.findIndexOfLastRelUpdate();
    if (lastRelUpdateIdx) {
      this.state = this.state.slice(lastRelUpdateIdx);
    }
  }

  map(proJ, conf) {
    return RedWSPSlave.create([this],
      () => ([value]) => proJ(value), conf);
  }

  distinct(equal, conf) {
    return RedWSPSlave.create([this],
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
}
