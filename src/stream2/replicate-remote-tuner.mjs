import { RED_REC_STATUS } from './record/red-record.mjs';
import RedWSP from './wsp/rwsp.mjs';
import { PUSH, STATUS_UPDATE, EMPTY } from './signals.mjs';
import { RET4_TYPES } from './retouch/retouch-types.mjs';
import Propagate from './propagate.mjs';
import STTMP from './sync-ttmp-ctr';
import Token from './token';

/**
 * @readonly
 * @enum {number}
 */
export const RED_WSP_TUNER_SUBORDINATION_MODE = {
  RED: 'RED',
  RI: 'RI',
};

export default class ReplicateRemoteTuner {
  constructor({ whenAllConnected }, onrdy, ctr, hnProJ) {
    this.rwsp = null;
    this.whenAllConnected = whenAllConnected;
    this.queue = null;
    this.ctr = ctr;
    this.wspR = null;
    this.hookR = null;
    this.onrdy = onrdy;
    this.wsp = null;
    this.hnProJ = hnProJ;
    this.binding = true;
    this.mode = RED_WSP_TUNER_SUBORDINATION_MODE.RED;
    /**
     * Request/Response delay
     * @type {number}
     */
    this.rQrSDelay = 0;
  }

  setup(redSTR, sigSTR) {
    this.whenAllConnected([redSTR, sigSTR], ([[wspR, hookR], [wsp, hook]]) => {
      this.ctr.todisconnect(hook);
      this.hookR = hookR;
      this.wspR = wspR;
      this.wsp = wsp;
      wspR.on(this);
      if (wsp instanceof RedWSP) {
        this.mode = RED_WSP_TUNER_SUBORDINATION_MODE.RI;
      }
      wsp.on(this);
    });
  }

  initialize(initialValue) {
    this.rwsp = RedWSP.create([this.wsp], this.hnProJ, {
      initialValue,
    });
    this.onrdy(this.rwsp);
  }

  initiateReT4(merge) {
    // Здесь срезается та часть очереди, которая находится
    // перед меткой, так как она начнет накатываться повторно
    let { queue } = this;
    if (this.queue.length) {
      if (Token.compare(merge, this.queue[0].rec) > 0) {
        const idx = this.queue.findIndex(
          ({ rec }) => Token.compare(merge, rec) <= 0,
        );
        queue = this.queue.slice(idx, Infinity);
      }
    }
    // Хранить здесь только неподтвержденную очередь?
    // Либо только актуальную с учетом мержа для воспроизведения
    this.rwsp.handleReT4(
      null,
      queue.map(({ rec }) => rec),
      RET4_TYPES.ABORT,
      { merge, initiator: this.rwsp },
    );
    this.normalizeQueue();
  }

  normalizeQueue() {
    // TODO: need refactor
    if (this.mode === RED_WSP_TUNER_SUBORDINATION_MODE.RED) {
      this.queue.splice(0, this.queue.findIndex(
        ({ status }) => status !== RED_REC_STATUS.SUCCESS,
      ) + 1);
    }
  }

  coordinate({ rec: { value }, id }) {
    this.hookR('coordinate', { value, id });
  }

  /**
   * RI ReT4
   */
  // eslint-disable-next-line class-methods-use-this
  handleReT4() {
    // RI ReT4 now correctly works from him source RWSP
  }

  handleR(rec) {
    const { src, value } = rec;
    if (value !== EMPTY) {
      // репликатор не требует согласования событий
      // так как контроллер гарантирует схожую с удаленным
      // сервисом механику организации действий
      if (src === this.wspR) {
        if (!this.rwsp) {
          this.queue = [];
          this.initialize(value);
        } else if (value.kind === STATUS_UPDATE) {
          const actIDX = this.queue.findIndex(({ id }) => id === value.id);
          const act = this.queue[actIDX];
          act.status = value.status;
          if (act.status === RED_REC_STATUS.SUCCESS) {
            this.normalizeQueue();
          } else {
            this.queue.splice(actIDX, 1);
            this.initiateReT4(act.rec);
          }
        } else if (value.kind === PUSH) {
          const act = {
            rec: Propagate.burn(value.data, STTMP.fromRawData(value.token), rec.head.src),
            status: RED_REC_STATUS.SUCCESS,
          };
          if (this.queue.length) {
            this.queue.unshift(act);
            this.initiateReT4(act.rec);
          } else {
            this.rwsp.handleR(act.rec);
          }
          // Состояние для узла не перезаписывается полностью
          //  вместо этого используется поверхностный мерж
          //  с учетом что RED всегда будет иметь хотябы одно
          //  стабильное состояние. Если задержка ответа превышает
          //  лимит ожидания, требуется полный реинит
        } else {
          throw new Error('Remote reinit callback isn\'t currently supported.');
        }
      }
    }
  }
}
