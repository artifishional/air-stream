import { RED_REC_STATUS } from './record/red-record';

export default class LocalRedWSPRecStatusCTR {
  static handleR(cuR) {
    queueMicrotask(() => {
      if (cuR.head.preRejected) {
        cuR.onRecordStatusUpdate(cuR, RED_REC_STATUS.FAILURE);
      } else {
        cuR.onRecordStatusUpdate(cuR, RED_REC_STATUS.SUCCESS);
      }
    });
  }
}
