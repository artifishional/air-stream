import { RED_REC_STATUS } from './record/red-record';
import RedWSP, { RED_WSP_LOCALIZATION } from './wsp/rwsp';
import { PUSH, STATUS_UPDATE, EMPTY } from './signals';
import Record from './record/record';

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
  }

  setup(redSTR, sigSTR) {
    this.whenAllConnected([redSTR, sigSTR], ([[wspR, hookR], [wsp, hook]]) => {
      this.ctr.todisconnect(hook);
      this.hookR = hookR;
      this.wspR = wspR;
      this.wsp = wsp;
      wspR.on(this);
      wsp.on(this);
    });
  }

  initialize(initialValue) {
    this.rwsp = RedWSP.create([this.wsp], this.hnProJ, {
      initialValue,
      localization: RED_WSP_LOCALIZATION.REMOTE,
    });
    this.onrdy(this.rwsp);
  }

  initiateReT4() {
    // Хранить здесь только неподтвержденную очередь?
    // Либо только актуальную с учетом мержа для воспроизведения
    this.queue = [];
  }

  handleR(rec) {
    const { src, value } = rec;
    if (value !== EMPTY) {
      if (src === this.wsp && this.rwsp) {
        const act = {
          state: rec.next,
          rec,
          status: RED_REC_STATUS.PENDING,
        };
        this.queue.push(act);
        queueMicrotask(() => {
          if (rec.head.preRejected) {
            act.status = RED_REC_STATUS.FAILURE;
            this.initiateReT4();
          } else {
            this.hookR('coordinate', act);
          }
        });
      } else if (src === this.wspR) {
        if (!this.rwsp) {
          this.queue = [{
            state: value,
            rec,
            status: RED_REC_STATUS.SUCCESS,
          }];
          this.initialize(value);
        } else if (value.kind === STATUS_UPDATE) {
          const act = this.queue.find(({ id }) => id === value.id);
          act.status = value.status;
        } else if (value.kind === PUSH) {
          const act = {
            state: null,
            rec: Record.fromRemote(rec, this.wsp, value.data),
            status: RED_REC_STATUS.SUCCESS,
          };
          if (this.queue.length > 1) {
            this.queue.splice(1, 0, act);
            this.initiateReT4();
          } else {
            this.wspR.handleR(act.rec);
            this.queue[0] = act;
          }
          // Здесь так только для варината когда не был инициирован
          //  ретач. Как достать состояние?
          //  Когда уже не возможно полностью восстановить состояние
          //  должен быть иницирован полный рекконнект
          //  это тайминг сохранениея очереди
          act.state = this.rwsp.getLastStateValue();
        } else {
          throw new Error('Remote reinit callback isn\'t currently supported.');
        }
      }
    }
  }
}
