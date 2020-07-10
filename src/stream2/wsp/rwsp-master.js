import RedWSP from './rwsp';
import { EMPTY } from '../signals';
import { RED_REC_STATUS, RED_REC_SUBORDINATION } from '../record/red-record';
import {RET4_TYPES} from "air-stream/src/stream2/retouch/retouch-types";

export default class RedWSPMaster extends RedWSP {
  constructor(wsps) {
    super(wsps, { subordination: RED_REC_SUBORDINATION.MASTER });
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
    this.t4queue = null;
    this.reliable = null;
    this.initialValue = initialValue;
  }

  handleR(src, cuR) {
    if (cuR.value !== EMPTY) {
      this.t4queue.push(cuR);
    }
    super.handleR(src, cuR);
  }

  onReT4Complete(src, _, data) {
    this.t4queue = [];
    this.reliable = [];
    super.onReT4Complete(src, _, data);
  }

  next(rec) {
    if (rec.value !== EMPTY) {
      if (this.subordination === RED_REC_SUBORDINATION.MASTER) {
        if (rec.status !== RED_REC_STATUS.PENDING) {
          this.reliable.push(rec);
        }
      }
      this.state.push(rec);
      /* <debug> */
      this.recHistory.push(rec);
      /* </debug> */
      rec.on(this);
    }
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
