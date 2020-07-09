import {
  RED_REC_STATUS,
  RED_REC_LOCALIZATION,
  RED_REC_SUBORDINATION,
  RedRecord,
} from '../record/red-record';
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

export default class RedWSP extends WSP {
  /**
  * @param {Array.<WSP|RedWSP>|null} wsps Список источников входных данных
  * Для мастера может быть только один источник
  * null - если это головной узел
  * @param {Boolean = false} reT4able Reinit getter when reT4
  * @param {RED_REC_LOCALIZATION} localization
  * @param {RED_REC_SUBORDINATION} subordination
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
    autoconfirm = true,
    subordination = RED_REC_SUBORDINATION.MASTER,
    localization = RED_REC_LOCALIZATION.LOCAL,
    reT4able = false,
    initialValue = EMPTY,
    ...args
  } = {}, /* <debug> */ creatorKey /* </debug> */) {
    super(wsps, args, /* <debug> */ creatorKey /* </debug> */);
    this.autoconfirm = autoconfirm;
    this.reT4able = reT4able;
    this.initialValue = initialValue;
    this.incompleteRet4 = null;
    // Если происходит изменение в состоянии то вызываются только реды
    this.redSlaves = new Set();
    this.localization = localization;
    this.subordination = subordination;
    this.state = null;
    this.hnProJReT4 = null;
    /* <debug> */
    this.recHistory = [];
    /* </debug> */
    /* <debug> */
    this.debug.reT4SpreadInProgress = false;
    /* </debug> */
  }

  /* <debug> */
  /*get originWSPs() {
    const res = super.originWSPs;
    if (this.state && this.state.some((rec) => !res.has(rec.head.src))) {
      throw new Error();
    }
    return res;
  }*/
  /* </debug> */

  initiate(hnProJ, after5FullUpdateHn) {
    if (this.subordination === RED_REC_SUBORDINATION.MASTER) {
      this.t4queue = [];
      this.reliable = [];
      this.state = [];
      this.next(new HeadRecord(
        null,
        this,
        null,
        Token.INITIAL_TOKEN,
        undefined,
        this.constructor.STATIC_LOCAL_WSP,
      ).from(this.initialValue, RedRecord, this, this));
    }
    this.hnProJReT4 = hnProJ;
    super.initiate(hnProJ, after5FullUpdateHn);
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
    /* <debug> */
    this.recHistory.push(rec);
    /* </debug> */
    if (!this.incompleteRet4) {
      // TODO: super.next(rec); after curFrameCachedRecord resolution
      // To prevent adding a subscriber while broadcasting
      [...this.slaves].forEach((slv) => slv.handleR(this, rec));
    }
    // TODO: не полное решение
    // есть ли необходисоть дергать апдейтер до того как заврешился тач?
    // и если нет, то как избежать пустых сообщений
    if (rec.value !== EMPTY) {
      this.after5FullUpdateHn();
    }
  }

  beginReT4(type, data) {
    // TODO: W reconstruct hn when init
    this.hn = this.hnProJReT4(this);
    this.incompleteRet4 = ReT4.create(this, type, data);
  }

  /**
   * @param rwsp
   * @param {Array.<Record>} reT4data
   * @param {RET4_TYPES} type
   * @param {RET4_TYPES} data abstract config
   */
  handleReT4(rwsp, reT4data, type, data) {
    if (!this.incompleteRet4) {
      this.beginReT4(type, data);
    }
    this.incompleteRet4.fill(rwsp, reT4data);
    // не требуются дополнительные усилия за контролем над устарешвей очередью
    // в случае ошибки - головная запись будет иметь соответсвтующий статус
    // в случае восстановления - все предыдущие действия уже должны будут завершиться
    // так как работа идет только в синхронном режиме
    // полное открытие просиходит тогда, когда удается разместить все
    // данные из смежных состояний
  }

  getUpdates() {
    if (this.wsps.length === 1) {
      return this.wsps[0].state;
    }
    return this.wsps
      .map(({ state }) => state)
      .flat()
      .sort((
        { token: { order: x, token: { sttmp: a } } },
        { token: { order: y, token: { sttmp: b } } },
      ) => a - b || x - y);
  }

  onReT4Complete({ type }, _, data) {
    const updates = this.getUpdates();
    this.state = [];
    updates.forEach((rec) => this.handleR(rec.src, rec));
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
      this, this.state, type, data,
    ));
    /* <debug> */
    this.debug.reT4SpreadInProgress = false;
    /* </debug> */
    this.after5FullUpdateHn();
  }

  createRecordFrom(rec, updates) {
    if (this.localization === RED_REC_LOCALIZATION.REMOTE) {
      if (rec.localization === RED_REC_LOCALIZATION.LOCAL) {
        return rec.from(updates, RedRecord, undefined, {
          subordination: RED_REC_SUBORDINATION.MASTER,
          localization: RED_REC_LOCALIZATION.REMOTE,
          status: RED_REC_STATUS.PENDING,
        });
      }
      return rec.from(updates, RedRecord, undefined, {
        subordination: RED_REC_SUBORDINATION.SLAVE,
        localization: RED_REC_LOCALIZATION.REMOTE,
        status: RED_REC_STATUS.PENDING,
      });
    }
    return rec.from(updates, RedRecord, undefined, this, {
      subordination: RED_REC_SUBORDINATION.MASTER,
      localization: RED_REC_LOCALIZATION.REMOTE,
      status: RED_REC_STATUS.SUCCESS,
    });
  }

  /**
   * @param {RedWSPSlave|RedWSP|WSP} slv
   */
  off(slv) {
    if (slv.subordination === RED_REC_SUBORDINATION.SLAVE) {
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
    if (slv.subordination === RED_REC_SUBORDINATION.SLAVE) {
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

  onRecordStatusUpdate(rec, status) {
    const indexOf = this.t4queue.indexOf(rec);
    this.t4queue.splice(indexOf, 1);
    if (status === RED_REC_STATUS.SUCCESS) {
      if (indexOf === 0) {
        this.reliable.push(this.state[this.reliable.length]);
      }
    } else if (status === RED_REC_STATUS.FAILURE) {
      this.state.splice(this.reliable.length, Infinity);
      this.t4queue.reduce((acc, _rec) => {
        const res = this.createRecordFrom(
          _rec, this.hn(acc.value, _rec.value), this,
        );
        this.state.push(res);
        return res;
      }, this.reliable.slice(-1)[0]);
      this.redSlaves.forEach((slv) => slv.handleReT4(this, this.state, RET4_TYPES.ABORT));
    }
  }
}
