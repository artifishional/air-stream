import { RED_REC_STATUS, RedRecord } from '../record/red-record';
import WSP from './wsp';
import ReT4 from '../retouch/retouch';
import { RET4_TYPES } from '../retouch/retouch-types';
import { EMPTY } from '../signals';
import getTTMP from '../get-ttmp';
import HeadRecord from '../record/head-record';
import Token from '../token';
// eslint-disable-next-line import/no-cycle
import RedWSPSlave from './rwsp-slave';

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
  * @param {RED_WSP_LOCALIZATION} localization
  * @param {RED_WSP_SUBORDINATION} subordination
  * @param {Boolean} autoconfirm
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
    localization = RED_WSP_LOCALIZATION.LOCAL,
    autoconfirm = localization === RED_WSP_LOCALIZATION.LOCAL,
    initialValue = EMPTY,
    ...args
  } = {}, /* <debug> */ creatorKey /* </debug> */) {
    super(wsps, args, /* <debug> */ creatorKey /* </debug> */);
    this.autoconfirm = autoconfirm;
    this.initialValue = initialValue;
    this.incompleteRet4 = null;
    // Если происходит изменение в состоянии то вызываются только реды
    this.redSlaves = new Set();
    this.localization = localization;
    this.subordination = subordination;
    this.state = null;
    this.hnProJReT4 = null;
    /* <debug> */
    this.debug.reT4SpreadInProgress = false;
    /* </debug> */
    this.$updateT4statusCTD = UPDATE_T4_STATUS_CTD_COUNTER;
  }

  /* <debug> */
  /* get originWSPs() {
    const res = super.originWSPs;
    if (this.state && this.state.some((rec) => !res.has(rec.head.src))) {
      throw new Error();
    }
    return res;
  } */
  /* </debug> */

  initiate(hnProJ, after5FullUpdateHn) {
    this.hnProJReT4 = hnProJ;
    if (this.subordination === RED_WSP_SUBORDINATION.MASTER) {
      this.state = [];
      this.next(new HeadRecord(
        null,
        this,
        null,
        Token.INITIAL_TOKEN,
        undefined,
        this.constructor.STATIC_LOCAL_WSP,
      ).from(this.initialValue, RedRecord, this, this));
      super.initiate(hnProJ, after5FullUpdateHn);
    } else {
      // to prevent W initiate hn
      super.initiate(null, after5FullUpdateHn);
    }
  }

  toJSON() {
    return {
      id: this.debug.id,
      species: this.constructor.name,
      configurable: this.configurable,
      state: this.state.map((rec) => rec.toJSON()),
      children: [...this.redSlaves].map((slave) => slave.toJSON()),
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

  /* <debug> */
  setupCTDrdy(wsps) {
    if (this.debug.reT4SpreadInProgress) {
      throw new Error('Unexpected model state');
    }
    if (this.incompleteRet4) {
      throw new Error('Unexpected model state');
    }
    super.setupCTDrdy(wsps);
  }
  /* </debug> */

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
    this.state = prms.merge
      ? this.state.splice(
        this.state.findIndex(
          ({ token }) => Token.compare(token, updates[0].token) < 0,
        ),
        Infinity,
      )
      : [];
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
    this.redSlaves.forEach((rwsp) => rwsp.handleReT4(
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
      RedRecord,
      undefined,
      this,
      this.autoconfirm ? RED_REC_STATUS.SUCCESS : RED_REC_STATUS.PENDING,
    );
  }

  /**
   * @param {RedWSPSlave|RedWSP|WSP} slv
   */
  off(slv) {
    if (slv.subordination === RED_WSP_SUBORDINATION.SLAVE) {
      this.redSlaves.delete(slv);
    }
    super.off(slv);
  }

  /**
   * @param {RedWSPSlave|RedWSP|WSP} slv
   */
  on(slv) {
    /* <debug> */
    if (!this.state) {
      throw new Error('Unexpected model state');
    }
    /* </debug> */
    /**
     * TODO: may be duplicate users
     */
    if (slv.subordination === RED_WSP_SUBORDINATION.SLAVE) {
      this.updateT4status();
      slv.handleReT4(this, this.state, RET4_TYPES.ReINIT);
      this.redSlaves.add(slv);
    }
    /**
     * TODO: опустошение очереди
     */
    this.curFrameCachedRecord = null;
    super.on(slv);
  }

  findIndexOfLastRelUpdate() {
    const relTTMP = getTTMP() - DEFAULT_MSG_ALIVE_TIME_MS;
    // eslint-disable-next-line no-plusplus
    for (let i = this.state.length; i--;) {
      const rec = this.state[i];
      if (rec.token.token.sttmp < relTTMP && rec.value !== EMPTY) {
        if (i === this.state.length - 1) {
          return i;
        }
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
