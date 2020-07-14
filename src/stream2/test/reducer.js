import EventEmitter from 'event-emitter';
import { stream2 as stream } from '../stream';
import { async } from '../../utils';
import WSP from '../wsp/wsp';
import { RED_REC_STATUS } from '../record/red-record';
import { STATUS_UPDATE } from '../signals';

// eslint-disable-next-line no-undef
const { describe, test, expect } = globalThis;

describe('reduce', () => {
  /* test('example', (done) => {
    const _ = async();
    const expected = [
      101,
      103,
      106,
    ];
    const rc1 = stream.fromCbFunc((cb) => {
      cb(1);
      _(() => cb(2));
      _(() => cb(3));
    });
    const r1 = rc1.reduce((acc, next) => acc + next, { local: 100 });
    const queue1 = expected.values();
    r1.get(({ value }) => expect(value).toEqual(queue1.next().value));
    _(() => queue1.next().done && done());
  });

  test('remote reducer', (done) => {
    const _ = async();
    const expected = [
      100,
      101,
      103,
    ];
    const rc1 = stream.fromCbFunc((cb) => {
      _(() => cb({ type: 'dot', data: 100 }));
      _(() => cb({ type: 'com', data: 1 }));
      _(() => cb({ type: 'com', data: 2 }));
    });
    const rm1 = rc1
      .filter(({ type }) => type === 'dot')
      .map(({ data }) => data);
    const r1 = rc1
      .filter(({ type }) => type === 'com')
      .map(({ data }) => data)
      .reduce((acc, next) => acc + next, { remote: rm1 });
    const queue1 = expected.values();
    r1.get(({ value }) => {
      expect(value).toEqual(queue1.next().value);
    });
    _(() => queue1.next().done && done());
  });

  test('remote reducer coordinate request', (done) => {
    const _ = async();
    const expected = [
      1,
    ];
    const queue1 = expected.values();
    const rc1 = stream.fromCbFunc((cb, ctr) => {
      ctr.req('coordinate', ({ value }) => {
        expect(value).toEqual(queue1.next().value);
        done();
      });
      _(() => cb({ type: 'dot', data: 100 }));
      _(() => cb({ type: 'com', data: 1 }));
    });
    const rm1 = rc1
      .filter(({ type }) => type === 'dot')
      .map(({ data }) => data);
    rc1
      .filter(({ type }) => type === 'com')
      .map(({ data }) => data)
      .reduce((acc, next) => acc + next, { remote: rm1 })
      .get();
  }); */

  test('remote reducer abort request & reT4', (done) => {
    const _ = async();
    // eslint-disable-next-line no-undef
    const proJ = jest.fn();
    const rc1 = stream.fromCbFunc((cb, ctr) => {
      ctr.req('coordinate', ({ value, id }) => {
        if (value === 1) {
          cb({
            type: 'dot',
            data: {
              id,
              kind: STATUS_UPDATE,
              status: RED_REC_STATUS.FAILURE,
            },
          });
        }
      });
      _(() => cb({ type: 'dot', data: 100 }));
      _(() => cb({ type: 'com', data: 1 }));
    });
    const rm1 = rc1
      .filter(({ type }) => type === 'dot')
      .map(({ data }) => data);
    const r1 = rc1
      .filter(({ type }) => type === 'com')
      .map(({ data }) => data)
      .reduce((acc, next) => acc + next, { remote: rm1 });
    r1.get(({ value }) => proJ(value));
    setTimeout(() => {
      expect(proJ.mock.calls).toEqual([
        [100],
        [101],
        // abort & reT4 here
        [100],
      ]);
      done();
    });
  });

  /*
  
  test('clear reducer construct with initialized stream', () => {});

  test('several subscriptions dissolved - source stream disconnect', (done) => {
    const wsp = new WSP();
    const dataCh = stream((connect, control) => {
      control.todisconnect(() => done());
      connect([wsp])([
        wsp.rec(1),
        wsp.rec(2),
      ]);
    });
    const store = new LocalReducer(
      dataCh,
      ({count}, vl) => ({count: count + vl}),
      {count: 0},
    );
    store.connect((_, hook) => (solid) => {
      solid.map(({value: {count}}) => {
        if (count === 3) {
          hook();
        }
      });
    });
    store.connect((_, hook) => (solid) => {
      solid.map(({value: {count}}) => {
        if (count === 1) {
          hook();
        }
      });
    });
    store.connect((_, hook) => (solid) => {
      solid.map(({value: {count}}) => {
        if (count === 0) {
          hook();
        }
      });
    });
  });

  it('abort action', (done) => {
    done = series(done, [
      evt => expect(evt).to.deep.equal(keyF),
      evt => expect(evt).to.deep.equal(0),
      evt => expect(evt).to.deep.equal(1),
      evt => expect(evt).to.deep.equal(3),
      evt => expect(evt).to.deep.equal(6),
      evt => expect(evt).to.deep.equal(keyF),
      evt => expect(evt).to.deep.equal(5),
      evt => expect(evt).to.deep.equal(9),
    ]);
    const source = new Observable(function (emt) {
      emt.kf();
      emt(0, {rid: 0});
      emt(1, {rid: 1});
      emt(2, {rid: 2});
      emt(3, {rid: 3});
      setTimeout(() => {
        emt(keyA, {is: {abort: true}, rid: 1});
        emt(4, {rid: 4});
      }, 0);
    });
    source
      .reducer((acc, next) => {
        return acc + next;
      })
      .on(done);
  });
  
  it('refresh history', (done) => {
    done = series(done, [
      evt => expect(evt).to.deep.equal(keyF),
    ]);
    const source = new Observable(function (emt) {
      emt.kf();
      emt(0, {rid: 0});
      emt(1, {rid: 1});
      emt(2, {rid: 2});
      emt(3, {rid: 3});
      emt.kf();
      emt(keyA, {is: {abort: true}, rid: 1});
    });
    source
      .reducer((acc, next) => {
        return acc + next;
      })
      .on(done);
  });

  test('single local red wsp with default value', (done) => {
    const _ = async();
    const expected = [
      0,
      2,
      5,
    ];
    const queue1 = expected.values();
    const rc = stream.fromCbFunc((cb) => {
      _(() => cb(2));
      _(() => cb(3));
    });
    const red1 = rc
      .reduce(() => (acc, next) => acc + next, {local: 0});
    red1.get(({value}) => expect(value).toEqual(queue1.next().value));
    _(() => queue1.next().done && done());
  });

  test('remote red wsp', (done) => {
    const _ = async();
    const expected = [
      24,
      25,
    ];
    const queue1 = expected.values();
    const ta2 = new EventEmitter();
    const rc2 = stream.fromNodeEvent(ta2, 'test-event', (vl) => vl);
    const remote = stream((onrdy, ctr) => {
      const wsp = WSP.create();
      ctr.tocommand((request, cuR) => {
        if (request === 'remote-confirm') {
          setTimeout(() => {
            cuR.onRecordStatusUpdate(cuR, RED_REC_STATUS.SUCCESS);
          });
        }
      });
      onrdy(wsp);
      _(() => wsp.burn(24));
    });
    const rc3 = rc2.reduce(() => (count, add) => count + add, { remote });
    rc3.get(({ value }) => {
      expect(value).toEqual(queue1.next().value);
    });
    _(() => ta2.emit('test-event', 1));
    _(() => queue1.next().done && done());
  });

  test('remote red wsp with reT4 from server', (done) => {
    const _ = async();
    const expected = [
      24,
      25,
      30,
    ];
    const queue1 = expected.values();
    const ta2 = new EventEmitter();
    const rc2 = stream.fromNodeEvent(ta2, 'test-event', (vl) => vl);
    const remote = stream((onrdy) => {
      const wsp = WSP.create();
      onrdy(wsp);
      _(() => wsp.burn(24));
      setTimeout(() => wsp.burn(30));
    });
    const rc3 = rc2.reduce(() => (count, add) => count + add, { remote });
    rc3.get(({ value }) => {
      expect(value).toEqual(queue1.next().value);
    });
    _(() => ta2.emit('test-event', 1));
    _(() => queue1.next().done && done());
  });*/
});
