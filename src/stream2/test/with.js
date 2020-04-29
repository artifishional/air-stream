import EventEmitter from 'event-emitter';
import { async } from '../../utils';
import { stream2 as stream } from '../index';

// eslint-disable-next-line no-undef
const { describe, test, expect } = globalThis;

describe('with', () => {
  /*test('example', (done) => {
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
*/
  test('slave rwsp reT4', (done) => {
    debugger;
    const _ = async();
    const expected = [
      [24, 25],
    ];
    const queue1 = expected.values();
    const rc1 = stream.fromCbFunc((cb) => {
      cb(1);
    })
      .reduce(() => (count, add) => count + add, { local: 23 });
    const ta2 = new EventEmitter();
    const rc2 = stream.fromNodeEvent(
      ta2,
      'test-event',
      (vl) => vl,
    );
    const rc3 = rc2.reduce(() => (count, add) => count + add, { remote: rc2 });
    const res = stream.with([rc1, rc3], () => {
      const state = new Map();
      return (updates) => {
        updates.forEach((rec) => state.set(rec.src, rec.value));
        return [...state.values()];
      };
    });
    res.get(({ value }) => expect(value).toEqual(queue1.next().value));
    _(() => ta2.emit('test-event', 25));
    _(() => queue1.next().done && done());
  });
});
