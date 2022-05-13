import { RED_REC_STATUS } from './record/red-record.mjs';
import RedWSP from './wsp/rwsp.mjs';
import { PUSH, STATUS_UPDATE, EMPTY } from './signals.mjs';
import { RET4_TYPES } from './retouch/retouch-types.mjs';
import Propagate from './propagate.mjs';
import STTMP from './sync-ttmp-ctr.mjs';
import Token from './token.mjs';
/* <debug> */ import Debug from './debug.mjs'; /* </debug> */

let COORDINATE_REQ_ID_COUNTER = 0;

/**
 * @readonly
 * @enum {number}
 */
export const RED_WSP_TUNER_SUBORDINATION_MODE = {
  RED: 'RED',
  RI: 'RI',
};

export default class ReduceRemoteTuner
  /* <debug> */extends Debug/* </debug> */ {
  constructor(
    _,
    onrdy,
    ctr,
    hnProJ,
    /* <debug> */dbg, /* </debug> */
  ) {
    /* <debug> */
    super({ type: 'reduce-remote-tuner' }, dbg);
    /* </debug> */
    this.rwsp = null;
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
    sigSTR.connect((wsp, hook) => {
      this.ctr.todisconnect(hook);
      this.wsp = wsp;
      if (wsp instanceof RedWSP) {
        this.mode = RED_WSP_TUNER_SUBORDINATION_MODE.RI;
      }
      wsp.on(this);
      redSTR.connect((wspR, hookR) => {
        this.ctr.todisconnect(hookR);
        this.hookR = hookR;
        this.wspR = wspR;
        wspR.on(this);
      });
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

  // Свдигает неподтвержденные записи на предполагаемую задержку
  //  (задержка на примере предыдущей записи)
  statusMove(actIDX, value) {
    const act = this.queue[actIDX];
    const dt = act.rec.token.token.statusUpdate(value.sttmp);
    for (let i = actIDX + 1; i < this.queue.length; i += 1) {
      this.queue[i].rec.token.token.statusMove(dt);
    }
  }

  /**
   * RI ReT4
   */
  // eslint-disable-next-line class-methods-use-this
  handleReT4() {
    // RI ReT4 now correctly works from him source RWSP
  }

  statusUpdate(src, value) {
    const actIDX = this.queue.findIndex(({ id }) => id === value.id);
    const act = this.queue[actIDX];
    act.status = value.status;
    // TODO: Now always reT4 cus need to agree sttmp
    if (act.status === RED_REC_STATUS.SUCCESS) {
      this.statusMove(actIDX, value);
      this.initiateReT4(act.rec);
      this.normalizeQueue();
    } else {
      this.queue.splice(actIDX, 1);
      this.initiateReT4(act.rec);
    }
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
              this.normalizeQueue();
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
          this.statusUpdate(src, value);
        } else if (value.kind === PUSH) {
          const act = {
            rec: Propagate.burn(value.data, STTMP.fromRawData(value.token), rec.head.src),
            status: RED_REC_STATUS.SUCCESS,
          };
          if (this.queue.length) {
            this.queue.unshift(act);
            this.initiateReT4(act.rec);
            this.normalizeQueue();
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
