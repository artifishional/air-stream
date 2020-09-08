/* eslint-disable import/extensions */
import { RED_REC_STATUS } from './record/red-record.js';
import RedWSP from './wsp/rwsp.js';
import { PUSH, STATUS_UPDATE, EMPTY } from './signals.js';
import { RET4_TYPES } from './retouch/retouch-types.js';
import Propagate from './propagate.js';
import STTMP from './sync-ttmp-ctr.js';

let COORDINATE_REQ_ID_COUNTER = 0;

/**
 * @readonly
 * @enum {number}
 */
export const RED_WSP_TUNER_SUBORDINATION_MODE = {
  RED: 'RED',
  RI: 'RI',
};

export default class ReduceRemoteTuner {
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
    // Хранить здесь только неподтвержденную очередь?
    // Либо только актуальную с учетом мержа для воспроизведения
    this.rwsp.handleReT4(
      null,
      this.queue.map(({ rec }) => rec),
      RET4_TYPES.ABORT,
      { merge },
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
      if (src === this.wsp && this.rwsp) {
        // TODO: need refactor
        if (this.mode === RED_WSP_TUNER_SUBORDINATION_MODE.RED) {
          const act = {
            id: -1,
            rec,
            status: RED_REC_STATUS.PENDING,
          };
          this.queue.push(act);
          queueMicrotask(() => {
            if (rec.head.preRejected) {
              act.status = RED_REC_STATUS.FAILURE;
              this.queue.splice(this.queue.indexOf(act), 1);
              this.initiateReT4(act.rec);
            } else {
              COORDINATE_REQ_ID_COUNTER += 1;
              act.id = COORDINATE_REQ_ID_COUNTER;
              this.coordinate(act);
            }
          });
        }
      } else if (src === this.wspR) {
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
