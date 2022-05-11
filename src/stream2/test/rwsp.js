import { async } from '../../utils';
import { stream2 as stream } from '../stream';
import RedWSP from '../wsp/rwsp';

// eslint-disable-next-line no-undef
const { describe, test, expect } = globalThis;

describe('RedWSP', () => {
  RedWSP.MSG_ALIVE_TIME_MS = 100;
  RedWSP.UPDATE_T4_STATUS_CTD_VALUE = 1;

  test('mandatory msg store view', (done) => {
    const _ = async();
    const red = stream
      .fromCbFn((cb) => {
        cb(1);
      })
      .store();
    red.connect();
    setTimeout(() => {
      _(() => expect(red.wsp.state.length).toEqual(1));
      _(done);
    }, RedWSP.MSG_ALIVE_TIME_MS);
  });

  test('mandatory delay msgs store view', (done) => {
    const _ = async();
    const red = stream
      .fromCbFn((cb) => {
        cb(1);
        _(() => cb(2));
        _(() => cb(3));
      })
      .store();
    red.connect();
    _(() => expect(red.wsp.state.length).toEqual(3));
    _(done);
  });

  test('cleanup store', (done) => {
    const _ = async();
    const red = stream
      .fromCbFn((cb) => {
        cb(1);
        _(() => cb(2));
        _(() => setTimeout(() => {
          _(() => cb(3));
          _(() => cb(4));
          _(() => expect(red.wsp.state.length).toEqual(3));
          _(done);
        }, RedWSP.MSG_ALIVE_TIME_MS + 1));
      })
      .store();
    red.connect();
  });

  test('mandatory actions + 1 stable action store view', (done) => {
    const _ = async();
    const red = stream
      .fromCbFn((cb) => {
        cb(1);
        setTimeout(() => _(() => cb(2)), RedWSP.MSG_ALIVE_TIME_MS);
      })
      .store();
    red.connect();
    setTimeout(() => {
      _(() => expect(red.wsp.state.length).toEqual(2));
      _(done);
    }, RedWSP.MSG_ALIVE_TIME_MS);
  });
});
