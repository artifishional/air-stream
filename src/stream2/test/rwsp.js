import Record from '../record/record';
import {
  RED_REC_STATUS,
  RedRecord,
} from '../record/red-record';
import RedWSP, { RED_WSP_LOCALIZATION } from '../wsp/rwsp';
import STTMP from '../sync-ttmp-ctr';
import { prop } from '../../utils';

// eslint-disable-next-line no-undef
const { describe, test, expect } = globalThis;

describe('RedWSP', () => {
  test('Forwarding a confirmed event', () => {
    const rwsp = new RedWSP(
      null,
      () => (count, add) => count + add,
    );
    rwsp.open([
      new Record(null, rwsp, 25, STTMP.get(3)),
    ]);
    rwsp.handleR(new RedRecord(
      null,
      rwsp,
      12,
      STTMP.get(4),
      undefined,
      RED_REC_STATUS.SUCCESS,
    ));
    expect(rwsp.state.slice(-2).map(prop('value'))).toEqual([25, 37]);
  });

  test('Forwarding a unconfirmed event', () => {
    const rwsp = new RedWSP(
      null,
      () => (count, add) => count + add,
    );
    rwsp.open([
      new Record(null, rwsp, 25, STTMP.get(3)),
    ]);
    rwsp.handleR(new RedRecord(
      null,
      rwsp,
      12,
      STTMP.get(4),
      undefined,
      RED_REC_STATUS.PENDING,
    ));
    expect(rwsp.state.slice(-2).map(prop('value'))).toEqual([25, 37]);
  });

  test('Event from controller - consecutive cancellation', () => {
    const rwsp = new RedWSP(
      null,
      () => (count, add) => count + add,
    );
    rwsp.open([
      new Record(null, rwsp, 25, STTMP.get(3)),
    ]);
    const aeR = new RedRecord(
      null,
      rwsp,
      12,
      STTMP.get(4),
      undefined,
      RED_REC_STATUS.PENDING,
    );
    rwsp.handleR(aeR);
    aeR.onRecordStatusUpdate(aeR, RED_REC_STATUS.FAILURE);
    rwsp.onRecordStatusUpdate(aeR, RED_REC_STATUS.FAILURE);
    expect(rwsp.state.slice(-1).map(prop('value'))).toEqual([25]);
  });

  test('Event from controller - non consecutive cancellation', () => {
    const rwsp = new RedWSP(
      null,
      () => (count, add) => count + add,
    );
    rwsp.open([
      new Record(null, rwsp, 25, STTMP.get(3)),
    ]);
    rwsp.handleR(new RedRecord(
      null,
      rwsp,
      2,
      STTMP.get(1),
      undefined,
      RED_REC_STATUS.PENDING,
    ));
    const aeR = new RedRecord(
      null,
      rwsp,
      1,
      STTMP.get(2),
      undefined,
      RED_REC_STATUS.PENDING,
    );
    rwsp.handleR(aeR);
    rwsp.handleR(new RedRecord(
      null,
      rwsp,
      -3,
      STTMP.get(3),
      undefined,
      RED_REC_STATUS.PENDING,
    ));
    aeR.onRecordStatusUpdate(aeR, RED_REC_STATUS.FAILURE);
    rwsp.onRecordStatusUpdate(aeR, RED_REC_STATUS.FAILURE);
    expect(rwsp.state.slice(-3).map(prop('value'))).toEqual([25, 27, 24]);
  });

  test('Transform segment type from remote to local', () => {
    const rwsp = new RedWSP(
      null,
      () => (count, add) => count + add,
      { localization: RED_WSP_LOCALIZATION.REMOTE },
    );
    rwsp.handleRt4(rwsp, [
      new Record(null, rwsp, 25, STTMP.get(1)),
    ]);
    const rwsp2 = RedWSP.with([rwsp], () => (count) => count);
    rwsp.handleR(new RedRecord(
      null,
      rwsp2,
      2,
      STTMP.get(2),
      undefined,
      RED_REC_STATUS.PENDING,
    ));
    expect(rwsp2.state.slice(-1).map(prop('localization')))
      .toEqual([RED_WSP_LOCALIZATION.REMOTE]);
    expect(rwsp.state.slice(-2).map(prop('value'))).toEqual([25, 27]);
  });
});
