import { stream2 as stream } from '../stream';
import { async } from '../../utils.mjs';

const { describe, test, expect } = globalThis;

describe('combine all', () => {
  test('simple this one lower stream', (done) => {
    const _ = async();
    const expected = [
      [10],
      [11],
    ];
    const queue1 = expected.values();
    const rc1In = stream
      .fromCbFn((cb) => {
        cb(10);
        _(() => cb(11));
      })
      .store();
    const rc1 = stream
      .fromCbFn((cb) => {
        _(() => cb([rc1In]));
      })
      .store();
    rc1.combineAll()
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    setTimeout(() => queue1.next().done && done());
  });

  test('this several lower streams', (done) => {
    const _ = async();
    const expected = [
      [10, 1],
      [20, 1],
      [20, 2],
    ];
    const queue1 = expected.values();
    const rc1In = stream
      .fromCbFn((cb) => {
        cb(10);
        _(() => cb(20));
      })
      .store();
    const rc2In = stream
      .fromCbFn((cb) => {
        cb(1);
        _(() => cb(2));
      })
      .store();
    const rc1 = stream
      .fromCbFn((cb) => {
        _(() => cb([rc1In, rc2In]));
      })
      .store();
    rc1.combineAll()
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    setTimeout(() => queue1.next().done && done());
  });

  test('update streams list with reT4 -> add new', (done) => {
    const _ = async();
    const expected = [
      [10],
      [20],
      [10, 1],
      [20, 1],
      [20, 2],
    ];
    const queue1 = expected.values();
    const rc1In = stream
      .fromCbFn((cb) => {
        cb(10);
        _(() => cb(20));
      })
      .store();
    rc1In.get();
    const rc2In = stream
      .fromCbFn((cb) => {
        cb(1);
        _(() => cb(2));
      })
      .store();
    rc2In.get();
    const rc1 = stream
      .fromCbFn((cb) => {
        _(() => cb([rc1In]));
        _(() => cb([rc1In, rc2In]));
      })
      .store();
    rc1.combineAll()
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    setTimeout(() => queue1.next().done && done());
  });

  test('async children stream', (done) => {
    const _ = async();
    const expected = [
      [10],
      // [20], locked
      [20, 1],
      [20, 2],
    ];
    const queue1 = expected.values();
    const rc1In = stream
      .fromCbFn((cb) => {
        cb(10); // 1
        _(() => cb(20)); // 4
      })
      .store();
    const rc2In = stream
      .fromCbFn((cb) => {
        _(() => cb(1)); // 5
        _(() => cb(2)); // 6
      })
      .store();
    const rc1 = stream
      .fromCbFn((cb) => {
        _(() => cb([rc1In])); // 2
        _(() => cb([rc1In, rc2In])); // 3
      })
      .store();
    rc1.combineAll()
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    setTimeout(() => queue1.next().done && done());
  });

  test('update streams list with reT4 -> del exs', (done) => {
    const _ = async();
    const expected = [
      [10, 1],
      [20, 1],
      [20, 2],
      [10],
      [20],
    ];
    const queue1 = expected.values();
    const rc1In = stream
      .fromCbFn((cb) => {
        cb(10);
        _(() => cb(20));
      })
      .store();
    rc1In.get();
    const rc2In = stream
      .fromCbFn((cb) => {
        cb(1);
        _(() => cb(2));
      })
      .store();
    rc2In.get();
    const rc1 = stream
      .fromCbFn((cb) => {
        _(() => cb([rc1In, rc2In]));
        _(() => cb([rc1In]));
      })
      .store();
    rc1.combineAll()
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    setTimeout(() => queue1.next().done && done());
  });

  test('array of streams from single src then combine', (done) => {
    const _ = async();
    const expected = [
      ['a1', 'b1'],
      ['a2', 'b2'],
    ];
    const queue1 = expected.values();
    const rc = stream
      .fromCbFn((cb) => {
        cb(new Map([['a', 'a1'], ['b', 'b1']]));
        _(() => cb(new Map([['a', 'a2'], ['b', 'b2']])));
      })
      .store();
    rc
      .kit()
      .map((list) => [...list.values()])
      .combineAll()
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    setTimeout(() => queue1.next().done && done());
  });

  test('empty list', (done) => {
    const expected = [
      [],
    ];
    const queue1 = expected.values();
    const rc = stream
      .fromCbFn((cb) => {
        cb(new Map());
      })
      .store();
    rc
      .kit()
      .map((list) => [...list.values()])
      .log()
      .combineAll()
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    setTimeout(() => queue1.next().done && done());
  });
});
