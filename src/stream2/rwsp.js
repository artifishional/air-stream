import {
  RED_REC_STATUS,
  RED_REC_LOCALIZATION,
  RED_REC_SUBORDINATION,
  RedRecord,
} from './red-record';
import WSP from './wsp';


export default class RedWSP extends WSP {
  /**
  * @param {[WSP]|null} streams Массив источников
  * Для мастера может быть только один источник
  * null - если это головной узел
  * @param {Function} hnProJ
  * @param {RED_REC_LOCALIZATION} localization
  * @param {RED_REC_SUBORDINATION} subordination
  */
  constructor(streams, hnProJ, {
    subordination = RED_REC_SUBORDINATION.MASTER,
    localization = RED_REC_LOCALIZATION.LOCAL,
  } = {}) {
    /* <@debug> */
    if (streams && streams.length > 1 && subordination === RED_REC_SUBORDINATION.MASTER) {
      throw new TypeError(
        'Unsupported configuration type. Master WSP can have no more than one source',
      );
    }
    /* <@/debug> */
    super(streams, hnProJ);
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
    if (streams) {
      streams.forEach((stream) => {
        if (stream instanceof RedWSP) {
          stream.onRed(this);
        }
        stream.on(this);
      });
    }
  }

  /**
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
    this.next(rec);
  }

  next(rec) {
    this.slaves.forEach((slv) => slv.handleR(this, rec));
  }

  handleRt4(/* stream, cuRt4 */) {
    return this;
  }

  fill(state) {
    this.t4queue = [];
    this.reliable = state;
    this.state = [...state];
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
    this.redSlaves.add(slv);
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
    }
    this.redSlaves.forEach((slv) => slv.handleR(this));
  }

  map(proJ) {
    return new RedWSP([this],
      () => ([[update]]) => proJ(update));
  }
}
