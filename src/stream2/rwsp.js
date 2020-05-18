import {
  RED_REC_STATUS,
  RED_REC_LOCALIZATION,
  RED_REC_SUBORDINATION,
  RedRecord,
} from './red-record';
import WSP from './wsp';
import ReT4, { RET4_TYPES } from './retouch';
import { EMPTY } from './signals';
import Record from './record';
import STTMP from './sync-ttmp-ctr';
import getTTMP from './get-ttmp';


const DEFAULT_START_TTMP = -1000000;
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
  */
  constructor(wsps, {
    subordination = RED_REC_SUBORDINATION.MASTER,
    localization = RED_REC_LOCALIZATION.LOCAL,
    reT4able = false,
    initialValue = EMPTY,
  } = {}, /* <debug> */ creatorKey /* </debug> */) {
    super(wsps, {}, /* <debug> */ creatorKey /* </debug> */);
    this.reT4able = reT4able;
    this.initialValue = initialValue;
    this.incompleteRet4 = null;
    this.opend = false;
    /**
     * @property {Map} handleRt4 synced map
     */
    this.event5RtoreWaves = null;
    // Если создается новая запись, то вызываются все слейвы
    this.slaves = new Set();
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
  }

  initiate(hnProJ) {
    if (this.subordination === RED_REC_SUBORDINATION.MASTER) {
      this.open([new RedRecord(
        null,
        this,
        this.initialValue,
        STTMP.get(DEFAULT_START_TTMP),
        undefined,
        this,
      )]);
    }
    // TODO: DUPLICATE BASE CH.
    // this.hn = this.hnProJ(this);
    super.initiate(hnProJ);
    if (this.wsps) {
      /**
       * Если это мастер, то только один источник, и он
       * рассматривается как контроллер
       */
      /* if (subordination === RED_REC_SUBORDINATION.MASTER) {
      } */
      /**
       * Если это слейв, то все источники должны быть накопителями
       */
      if (this.subordination === RED_REC_SUBORDINATION.SLAVE) {
        this.wsps.forEach((rwsp) => rwsp.onRed(this));
      }
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
    /* <@debug> */
    if (!this.opend) {
      throw new Error('Wsp is not opened');
    }
    /* <@/debug> */
    const rec = this.createRecordFrom(cuR,
      this.hn(this.state.slice(-1)[0].value, cuR.value));
    if (cuR.subordination === RED_REC_SUBORDINATION.MASTER) {
      if (cuR.status === RED_REC_STATUS.PENDING) {
        this.t4queue.push(cuR);
      } else {
        this.t4queue.push(cuR);
        this.reliable.push(rec);
      }
    } else if (cuR.subordination === RED_REC_SUBORDINATION.SLAVE) {
      this.t4queue.push(cuR);
    } else {
      this.t4queue.push(cuR);
    }
    this.state.push(rec);
    rec.on(this);
    this.next(rec);
  }

  next(rec) {
    this.slaves.forEach((slv) => slv.handleR(this, rec));
  }

  /**
   * @param rwsp
   * @param reT4data
   * @param {RET4_TYPES} type
   */
  handleReT4(rwsp, reT4data, type) {
    if (!this.incompleteRet4) {
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

  onReT4Complete(updates) {
    // TODO: DUPLICATE BASE CH.
    if (!this.hn || this.reT4able) {
      this.hn = this.hnProJ(this);
    }
    const state = [];
    const combined = [];
    updates.forEach((wave) => {
      wave.forEach(([idx, rec]) => {
        combined[idx] = rec;
      });
      if (combined.length < this.streams.size || combined.includes()) {
        return;
      }
      let acc = null;
      if (state.length > 0) {
        [acc] = state.slice(-1);
      } else if (this.initialValue !== EMPTY) {
        acc = this.initialValue;
      }
      state.push(this.createRecordFrom(
        wave[0][1],
        this.hn(
          acc,
          wave.map(([, rec]) => rec),
          combined,
        ),
      ));
    });
    this.incompleteRet4 = null;
    return this.open(state);
  }

  open(state) {
    // TODO: TypeCheck
    if (state.some((rec) => !(rec instanceof Record))) {
      debugger;
    }
    this.opend = true;
    this.t4queue = [];
    this.reliable = state;
    this.state = [...state];
    this.redSlaves.forEach((rwsp) => rwsp.handleReT4(
      this,
      this.state,
      RET4_TYPES.ReINIT,
    ));
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
    return rec.from(updates, RedRecord, undefined, {
      subordination: RED_REC_SUBORDINATION.MASTER,
      localization: RED_REC_LOCALIZATION.REMOTE,
    });
  }

  offRed(slv) {
    this.redSlaves.delete(slv);
  }

  onRed(slv) {
    /**
     * TODO: may be duplicate users
     */
    if (this.state) {
      this.updateT4status();
      slv.handleReT4(this, this.state, RET4_TYPES.ReINIT);
    }
    this.redSlaves.add(slv);
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
          _rec, this.hn(acc.value, _rec.value),
        );
        this.state.push(res);
        return res;
      }, this.reliable.slice(-1)[0]);
      this.redSlaves.forEach((slv) => slv.handleReT4(this, this.state, RET4_TYPES.ReINIT));
    }
  }
}
