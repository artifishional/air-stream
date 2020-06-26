import {
  RED_REC_STATUS,
  RED_REC_LOCALIZATION,
  RED_REC_SUBORDINATION,
  RedRecord,
} from './record/red-record';
import WSP from './wsp';
import ReT4 from './retouch';
import { RET4_TYPES } from './retouch-types';
import { EMPTY } from './signals';
import getTTMP from './get-ttmp';
import HeadRecord from './record/head-record';
import Token from './token';
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
    subordination = RED_REC_SUBORDINATION.MASTER,
    localization = RED_REC_LOCALIZATION.LOCAL,
    reT4able = false,
    initialValue = EMPTY,
    ...args
  } = {}, /* <debug> */ creatorKey /* </debug> */) {
    super(wsps, args, /* <debug> */ creatorKey /* </debug> */);
    this.reT4able = reT4able;
    this.initialValue = initialValue;
    this.incompleteRet4 = null;
    // Если происходит изменение в состоянии то вызываются только реды
    this.redSlaves = new Set();
    this.localization = localization;
    this.subordination = subordination;
    // если среди стримов есть хотябы один контроллер - то это мастер редьюсер,
    // мастер редьюсер должен получить начальное состояние извне
    // в ином случае состояние создается на базе мастер стримов

    // В первой хранится текущее (надежное) состояние
    // Во второй очереди хранятся события в исходном виде
    // Второая очередь является дополнением к первой

    // В третьей очереди хранится результирующее состояние
    // Причем первый элемент является бессрочным

    // действия могут быть отменены в результате исключения
    // это значит что для любого действия требуется короткое ожидание
    this.reliable = null;
    this.t4queue = null;
    this.state = null;
    this.hnProJReT4 = null;
  }

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

  after5FullUpdateHn() {
    if (!this.incompleteRet4) {
      super.after5FullUpdateHn();
    }
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

  handleR(src, cuR) {
    if (cuR.value !== EMPTY) {
      this.t4queue.push(cuR);
    }
    super.handleR(src, cuR);
  }

  next(rec) {
    if (rec.value !== EMPTY) {
      if (this.subordination === RED_REC_SUBORDINATION.MASTER) {
        if (rec.status !== RED_REC_STATUS.PENDING) {
          this.reliable.push(rec);
        }
      }
      this.state.push(rec);
      rec.on(this);
    }
    if (!this.incompleteRet4) {
      // TODO: super.next(rec); after curFrameCachedRecord resolution
      // To prevent adding a subscriber while broadcasting
      [...this.slaves].forEach((slv) => slv.handleR(this, rec));
    }
    this.after5FullUpdateHn();
  }

  /**
   * @param rwsp
   * @param {Array.<Record>} reT4data
   * @param {RET4_TYPES} type
   */
  handleReT4(rwsp, reT4data, type /* , wsps = ? */) {
    if (!this.incompleteRet4) {
      this.hn = this.hnProJReT4(this);
      this.incompleteRet4 = ReT4.create(this, type);
    }
    this.incompleteRet4.fill(rwsp, reT4data);
    // не требуются дополнительные усилия за контролем над устарешвей очередью
    // в случае ошибки - головная запись будет иметь соответсвтующий статус
    // в случае восстановления - все предыдущие действия уже должны будут завершиться
    // так как работа идет только в синхронном режиме
    // полное открытие просиходит тогда, когда удается разместить все
    // данные из смежных состояний
  }

  onReT4Complete(type, updates) {
    this.t4queue = [];
    this.reliable = [];
    this.state = [];
    updates.forEach((rec) => this.handleR(rec.src, rec));
    this.incompleteRet4 = null;
    this.redSlaves.forEach((rwsp) => rwsp.handleReT4(
      this, this.state, type,
    ));
    this.after5FullUpdateHn();
  }

  createRecordFrom(rec, updates) {
    if (this.localization === RED_REC_LOCALIZATION.REMOTE) {
      if (rec.localization === RED_REC_LOCALIZATION.LOCAL) {
        return rec.from(updates, RedRecord, undefined, {
          subordination: RED_REC_SUBORDINATION.MASTER,
          localization: RED_REC_LOCALIZATION.REMOTE,
        });
      }
      return rec.from(updates, RedRecord, undefined, {
        subordination: RED_REC_SUBORDINATION.SLAVE,
        localization: RED_REC_LOCALIZATION.REMOTE,
      });
    }
    return rec.from(updates, RedRecord, undefined, this, {
      subordination: RED_REC_SUBORDINATION.MASTER,
      localization: RED_REC_LOCALIZATION.REMOTE,
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
    let i;
    // eslint-disable-next-line no-plusplus
    for (i = this.state.length; i--;) {
      const state = this.state[i];
      if (state.token.sttmp < relTTMP) {
        if (i === this.state.length - 1) {
          return i;
        }
        return i + 1;
      }
    }
    return 0;
  }

  updateT4status() {
    const lastRelUpdateIdx = this.findIndexOfLastRelUpdate();
    this.state = this.state.slice(lastRelUpdateIdx);
  }

  map(proJ, conf) {
    return RedWSPSlave.create([this],
      () => ([value]) => proJ(value), conf);
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
