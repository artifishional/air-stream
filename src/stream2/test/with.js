import EventEmitter from 'event-emitter';
import { async } from '../../utils';
import { stream2 as stream } from '../index';
import WSP from '../wsp';
import { RED_REC_STATUS } from '../red-record';

// eslint-disable-next-line no-undef
const { describe, test, expect } = globalThis;

describe('with', () => {
 /* test('example', (done) => {
    const _ = async();
    const expected = [
      [1], [1, 2],
    ];
    const ta1 = new EventEmitter();
    const rc1 = stream.fromNodeEvent(
      ta1,
      'test-event',
      (vl) => vl,
    );
    _(() => ta1.emit('test-event', 1));
    const ta2 = new EventEmitter();
    const rc2 = stream.fromNodeEvent(
      ta2,
      'test-event',
      (vl) => vl,
    );
    _(() => ta2.emit('test-event', 2));
    const queue1 = expected.values();
    stream.with([rc1, rc2], () => {
      const state = new Map();
      return (updates) => {
        updates.forEach((rec) => state.set(rec.src, rec.value));
        return [...state.values()];
      };
    })
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    _(() => queue1.next().done && done());
  });

  test('single wsp (sync mode)', (done) => {
    const _ = async();
    const expected = [
      ['a1', 'b1'],
    ];
    const rc = stream.fromCbFunc((cb) => {
      _(() => cb(1));
    });
    const rc1 = rc.map(({ value }) => `a${value}`);
    const rc2 = rc.map(({ value }) => `b${value}`);
    const queue1 = expected.values();
    stream.with([rc1, rc2], () => {
      debugger;
      const state = new Map();
      return (updates) => {
        updates.forEach((rec) => state.set(rec.src, rec.value));
        return [...state.values()];
      };
    })
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    _(() => queue1.next().done && done());
  });

  test('single wsp (sync mode) with empty record', (done) => {
    const _ = async();
    const expected = [
      ['a1'], ['a2'],
    ];
    const rc = stream.fromCbFunc((cb) => {
      _(() => cb(1));
      _(() => cb(2));
    });
    const rc1 = rc.map(({ value }) => `a${value}`);
    const rc2 = rc.filter(() => false);
    const queue1 = expected.values();
    stream.with([rc1, rc2], () => {
      const state = new Map();
      return (updates) => {
        updates.forEach((rec) => state.set(rec.src, rec.value));
        return [...state.values()];
      };
    })
      .get(({ value }) => expect(value).toEqual(queue1.next().value));
    _(() => queue1.next().done && done());
  });

  test('single wsp (sync mode) - record retention mex', (done) => {
    const _ = async();
    const expected = [
      ['a1', 'b1'],
    ];
    const rc = stream.fromCbFunc((cb) => {
      cb(1);
    });
    const rc1 = rc.map(({ value }) => `a${value}`);
    const rc2 = rc.map(({ value }) => `b${value}`);
    const queue1 = expected.values();
    const res = stream.with([rc1, rc2], () => {
      const state = new Map();
      return (updates) => {
        updates.forEach((rec) => state.set(rec.src, rec.value));
        return [...state.values()];
      };
    });
    res.connect();
    res.get(({ value }) => expect(value).toEqual(queue1.next().value));
    _(() => queue1.next().done && done());
  });

  // late stream connection on several wspS

  // late stream connection on single wsp - is it real?
  // !~ single (wsp DOESN'T supp several events per frame) - now i'ts supported
  // single wsp is a single wsp - it is always synchronized with itself
  // what about a stream with combined wsp?

  test('several local RedWSP to local RedSWPSlave', (done) => {
    const _ = async();
    const expected = [
      [101, 12],
    ];
    const rc1 = stream.fromCbFunc((cb) => {
      cb(1);
    });
    const rc2 = stream.fromCbFunc((cb) => {
      cb(2);
    });
    const r1 = rc1.reduce(() => (acc, next) => acc + next, { local: 100 });
    const r2 = rc2.reduce(() => (acc, next) => acc + next, { local: 10 });
    const queue1 = expected.values();
    const res = stream.with([r1, r2], () => {
      const state = new Map();
      return (updates) => {
        updates.forEach((rec) => state.set(rec.src, rec.value));
        return [...state.values()];
      };
    });
    res.connect();
    res.get(({ value }) => expect(value).toEqual(queue1.next().value));
    _(() => queue1.next().done && done());
  });
  */

  test('several remote RedWSP to local RedSWPSlave', (done) => {
    const _ = async();
    const expected = [
      [102],
      [102, 11],
    ];
    const rc1 = stream.fromCbFunc((cb) => {
      setTimeout(() => {
        _(() => cb({ type: 'dot', data: 10 }));
        _(() => cb({ type: 'com', data: 1 }));
      });
    });
    const rc2 = stream.fromCbFunc((cb) => {
      _(() => cb({ type: 'dot', data: 100 }));
      _(() => cb({ type: 'com', data: 2 }));
    });
    const rm1 = rc1
      .filter(({ type }) => type === 'dot')
      .map(({ data }) => data);
    const rm2 = rc2
      .filter(({ type }) => type === 'dot')
      .map(({ data }) => data);
    const r1 = rc1
      .filter(({ type }) => type === 'com')
      .map(({ data }) => data)
      .reduce(() => (acc, next) => acc + next, { remote: rm1 });
    const r2 = rc2
      .filter(({ type }) => type === 'com')
      .map(({ data }) => data)
      .reduce(() => (acc, next) => acc + next, { remote: rm2 });
    const queue1 = expected.values();
    const res = stream.with([r1, r2], () => {
      const state = new Map();
      return (updates) => {
        updates.forEach((rec) => state.set(rec.src, rec.value));
        return [...state.values()];
      };
    });
    res.connect();
    res.get(({ value }) => {
      expect(value).toEqual(queue1.next().value);
    });
    setTimeout(() => _(() => queue1.next().done && done()));
  });
});
