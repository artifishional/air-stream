import Record from '../record';
import {
  RED_REC_LOCALIZATION,
  RED_REC_STATUS,
  RED_REC_SUBORDINATION,
  RedRecord,
} from '../red-record';
import RedWSP from '../rwsp';
import STTMP from '../sync-ttmp-controller';

// eslint-disable-next-line no-undef
const { describe, test, expect } = globalThis;

function prop(property) {
  return (data) => data[property];
}

describe('RedWSP', () => {
  test('Forwarding a confirmed event', () => {
    const rwsp = new RedWSP(
      null,
      () => (count, add) => count + add,
    );
    rwsp.fill([
      new Record(null, rwsp, 25, STTMP.get(3)),
    ]);
    rwsp.handleR(null, new RedRecord(
      null,
      rwsp,
      12,
      STTMP.get(4),
      undefined,
      {
        subordination: RED_REC_SUBORDINATION.MASTER,
        status: RED_REC_STATUS.SUCCESS,
        localization: RED_REC_LOCALIZATION.REMOTE,
      },
    ));
    expect(rwsp.state.slice(-2).map(prop('value'))).toEqual([25, 37]);
  });

  test('Forwarding a unconfirmed event', () => {
    const rwsp = new RedWSP(
      null,
      () => (count, add) => count + add,
    );
    rwsp.fill([
      new Record(null, rwsp, 25, STTMP.get(3)),
    ]);
    rwsp.handleR(null, new RedRecord(
      null,
      rwsp,
      12,
      STTMP.get(4),
      undefined,
      {
        subordination: RED_REC_SUBORDINATION.MASTER,
        status: RED_REC_STATUS.PENDING,
        localization: RED_REC_LOCALIZATION.REMOTE,
      },
    ));
    expect(rwsp.state.slice(-2).map(prop('value'))).toEqual([25, 37]);
  });

  test('Event from controller - consecutive cancellation', () => {
    const rwsp = new RedWSP(
      null,
      () => (count, add) => count + add,
    );
    rwsp.fill([
      new Record(null, rwsp, 25, STTMP.get(3)),
    ]);
    const aeR = new RedRecord(
      null,
      rwsp,
      12,
      STTMP.get(4),
      undefined,
      {
        subordination: RED_REC_SUBORDINATION.MASTER,
        status: RED_REC_STATUS.PENDING,
        localization: RED_REC_LOCALIZATION.REMOTE,
      },
    );
    rwsp.handleR(null, aeR);
    aeR.onRecordStatusUpdate(aeR, RED_REC_STATUS.FAILURE);
    rwsp.onRecordStatusUpdate(aeR, RED_REC_STATUS.FAILURE);
    expect(rwsp.state.slice(-1).map(prop('value'))).toEqual([25]);
  });

  test('Event from controller - non consecutive cancellation', () => {
    const rwsp = new RedWSP(
      null,
      () => (count, add) => count + add,
    );
    rwsp.fill([
      new Record(null, rwsp, 25, STTMP.get(3)),
    ]);
    rwsp.handleR(null, new RedRecord(
      null,
      rwsp,
      2,
      STTMP.get(1),
      undefined,
      {
        subordination: RED_REC_SUBORDINATION.MASTER,
        status: RED_REC_STATUS.PENDING,
        localization: RED_REC_LOCALIZATION.REMOTE,
      },
    ));
    const aeR = new RedRecord(
      null,
      rwsp,
      1,
      STTMP.get(2),
      undefined,
      {
        subordination: RED_REC_SUBORDINATION.MASTER,
        status: RED_REC_STATUS.PENDING,
        localization: RED_REC_LOCALIZATION.REMOTE,
      },
    );
    rwsp.handleR(null, aeR);
    rwsp.handleR(null, new RedRecord(
      null,
      rwsp,
      -3,
      STTMP.get(3),
      undefined,
      {
        subordination: RED_REC_SUBORDINATION.MASTER,
        status: RED_REC_STATUS.PENDING,
        localization: RED_REC_LOCALIZATION.REMOTE,
      },
    ));
    aeR.onRecordStatusUpdate(aeR, RED_REC_STATUS.FAILURE);
    rwsp.onRecordStatusUpdate(aeR, RED_REC_STATUS.FAILURE);
    expect(rwsp.state.slice(-3).map(prop('value'))).toEqual([25, 27, 24]);
  });

  test('Transform segment type from remote to local', () => {
    const rwsp = new RedWSP(
      null,
      () => (count, add) => count + add,
    );
    const rwsp2 = new RedWSP(
      [rwsp],
      () => (count, add) => count + add,
      { localization: RED_REC_LOCALIZATION.REMOTE },
    );
    rwsp.fill([
      new Record(null, rwsp, 25, STTMP.get(3)),
    ]);
    rwsp.handleR(null, new RedRecord(
      null,
      rwsp2,
      2,
      STTMP.get(1),
      undefined,
      {
        subordination: RED_REC_SUBORDINATION.MASTER,
        status: RED_REC_STATUS.PENDING,
        localization: RED_REC_LOCALIZATION.LOCAL,
      },
    ));
    expect(rwsp.state.slice(-1).map(prop('localization')))
      .toEqual([RED_REC_LOCALIZATION.REMOTE]);
    expect(rwsp.state.slice(-2).map(prop('value'))).toEqual([25, 27]);
  });
});