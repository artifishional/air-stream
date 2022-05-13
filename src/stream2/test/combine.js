import { stream2 as stream } from '../stream.mjs';
import { async } from '../../utils.mjs';

const { describe, test, expect } = globalThis;

describe('combine', () => {
  test('combine example', (done) => {
    const _ = async();
    const expected = [
      200,
      220,
      242,
    ];
    const queue1 = expected.values();
    const rc1 = stream
      .fromCbFn((cb) => {
        cb(10);
        _(() => cb(11));
      })
      .store();
    const rc2 = stream
      .fromCbFn((cb) => {
        cb(20);
        _(() => cb(22));
      })
      .store();
    stream.combine([rc1, rc2], ([vl1, vl2]) => vl1 * vl2)
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    _(() => queue1.next().done && done());
  });

  test('combine after initialization', (done) => {
    const _ = async();
    const expected = [
      [10],
      [20],
    ];
    const queue1 = expected.values();
    const rc1 = stream
      .fromCbFn((cb) => {
        cb(10);
        _(() => cb(20));
      })
      .store();
    rc1.get();
    _(() => {
      stream.combine([rc1])
        .get(({ value }) => {
          expect(value).toEqual(queue1.next().value);
        });
    });
    _(() => queue1.next().done && done());
  });

  test('several streams - single wsp', (done) => {
    const _ = async();
    const expected = [
      240,
      286,
    ];
    const queue1 = expected.values();
    const rc = stream
      .fromCbFn((cb) => {
        cb(10);
        _(() => cb(11));
      })
      .store();
    const rc1 = rc.map((v) => v * 2);
    const rc2 = rc.map((v) => v + 2);
    stream.combine([rc1, rc2], ([vl1, vl2]) => vl1 * vl2)
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    _(() => queue1.next().done && done());
  });

  test('single stream', (done) => {
    const _ = async();
    const expected = [
      10,
      11,
    ];
    const queue1 = expected.values();
    const rc = stream
      .fromCbFn((cb) => {
        cb(10);
        _(() => cb(11));
      })
      .store();
    stream.combine([rc], ([vl1]) => vl1)
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    _(() => queue1.next().done && done());
  });

  test('empty collection of streams', (done) => {
    const _ = async();
    const expected = [
      [],
    ];
    const queue1 = expected.values();
    const rc = stream
      .fromCbFn((cb) => {
        cb([]);
      })
      .store();
    stream.combine([rc], ([vl1]) => vl1)
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    _(() => queue1.next().done && done());
  });

  test('several remote RedWSP to local RedSWPSlave', (done) => {
    const _ = async();
    const expected = [
      // теперь это +1 stable msg
      1000,
      1020,
      1122,
    ];
    const rc1 = stream.fromCbFn((cb) => {
      setTimeout(() => {
        _(() => cb({ type: 'dot', data: 10 }));
        _(() => cb({ type: 'com', data: 1 }));
      });
    });
    const rc2 = stream.fromCbFn((cb) => {
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
      .reduce((acc, next) => acc + next, { remote: rm1 });
    const r2 = rc2
      .filter(({ type }) => type === 'com')
      .map(({ data }) => data)
      .reduce((acc, next) => acc + next, { remote: rm2 });
    const queue1 = expected.values();
    const res = stream.combine([r1, r2], ([vl1, vl2]) => vl1 * vl2);
    res.get(({ value }) => {
      expect(value).toEqual(queue1.next().value);
    });
    setTimeout(() => _(() => queue1.next().done && done()));
  });

  test('head combineAllFirst example', (done) => {
    const _ = async();
    const expected = [
      [10, 20],
    ];
    const queue1 = expected.values();
    stream
      .fromCbFn((headCb) => {
        _(() => headCb([
          stream
            .fromCbFn((cb) => {
              _(() => cb(10));
            })
            .store(),
          stream
            .fromCbFn((cb) => {
              _(() => cb(20));
            })
            .store(),
        ]));
      })
      .combineAllFirst()
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    setTimeout(() => queue1.next().done && done());
  });

  test('empty list of streams', (done) => {
    const _ = async();
    const expected = [
      [],
    ];
    const queue1 = expected.values();
    stream
      .combine([])
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    _(() => queue1.next().done && done());
  });

  test('combine series', (done) => {
    const _ = async();
    const expected = [
      [[10, 20], 30],
    ];
    const queue1 = expected.values();
    const a = stream
      .fromCbFn((headCb) => {
        _(() => headCb([
          stream
            .fromCbFn((cb) => {
              _(() => cb(10));
            })
            .store(),
          stream
            .fromCbFn((cb) => {
              _(() => cb(20));
            })
            .store(),
        ]));
      })
      .combineAllFirst();
    const b = stream
      .fromCbFn((cb) => {
        cb(30);
      })
      .store();
    stream.combine([a, b])
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    setTimeout(() => queue1.next().done && done());
  });

  test('extended combine -> dynamic add stream', (done) => {
    const _ = async();
    const expected = [
      [1, 10],
      // [2, 20], locked
      // reconstruct here and rebase
      [1, 10, 11],
      [2, 20, 22],
      [3, 30, 33],
    ];
    const queue1 = expected.values();
    const src = stream
      .fromCbFn((cb) => {
        cb(1);
        _(() => cb(2));
        _(() => cb(3));
      })
      .store();
    const a = src.map((vl) => vl);
    const b = src.map((vl) => vl * 10);
    const c = src.map((vl) => vl * 11);
    stream
      .eCombine(
        [a, b],
        (values) => values,
        (values) => [a, b, ...values[0] > 1 ? [c] : []],
      )
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    setTimeout(() => queue1.next().done && done());
  });

  test('extended combine dyn add async stream', (done) => {
    const _ = async();
    const expected = [
      [1, 10],
      // [2, 20], locked
      // reconstruct here and rebase
      [2, 20, 11],
      [3, 30, 11],
      [3, 30, 22],
      [3, 30, 33],
    ];
    const queue1 = expected.values();
    const s1 = stream
      .fromCbFn((cb) => {
        cb(1);
        _(() => cb(2));
        _(() => cb(3));
      })
      .store();
    const s2 = stream
      .fromCbFn((cb) => {
        cb(1);
        _(() => cb(2));
        _(() => cb(3));
      })
      .store();
    const a = s1.map((vl) => vl);
    const b = s1.map((vl) => vl * 10);
    const c = s2.map((vl) => vl * 11);
    stream
      .eCombine(
        [a, b],
        (vl) => vl,
        (values) => [a, b, ...values[0] > 1 ? [c] : []],
      )
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    setTimeout(() => queue1.next().done && done());
  });

  test('nested extended combine -> dynamic add stream', (done) => {
    const _ = async();
    const expected = [
      [[1, 10], 11],
      // [[2, 20], 22], locked
      // reconstruct here and rebase
      [[1, 10, 11], 11],
      [[2, 20, 22], 22],
      [[3, 30, 33], 33],
    ];
    const queue1 = expected.values();
    const s1 = stream
      .fromCbFn((cb) => {
        cb(1);
        _(() => cb(2));
        _(() => cb(3));
      })
      .store();
    const a = s1.map((vl) => vl);
    const b = s1.map((vl) => vl * 10);
    const c = s1.map((vl) => vl * 11);
    const com1 = stream
      .eCombine(
        [a, b],
        (vl) => vl,
        (values) => [a, b, ...values[0] > 1 ? [c] : []],
      );
    stream
      .combine([com1, c])
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    setTimeout(() => queue1.next().done && done());
  });

  test('empty source combiner', (done) => {
    const expected = [
      0,
    ];
    const queue1 = expected.values();
    stream
      .combine([], ({ length }) => length)
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    setTimeout(() => queue1.next().done && done());
  });

  test('loop', (done) => {
    const _ = async();
    const expected = [
      ['a1', 'a', 'a'],
      ['b1', 'b', 'b'],
      ['c1', 'c', 'c'],
    ];
    const queue1 = expected.values();
    const s1 = stream
      .fromCbFn((cb) => {
        cb('a');
        _(() => cb('b'));
        _(() => cb('c'));
      })
      .store();
    const a = s1.map((vl) => `${vl}1`);
    const b = s1.distinct();
    stream
      .combine([a, b, s1])
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    setTimeout(() => queue1.next().done && done());
  });

  test('sync when reT4 through EMPTY record', (done) => {
    const _ = async();
    const expected = [
      [1, 10],
      [1, 20],
      // [1, 30], locked
      // reconstruct here and rebase
      [1, 10, 11],
      [1, 20, 22],
      [1, 30, 33],
    ];
    const queue1 = expected.values();
    const s1 = stream
      .fromCbFn((cb) => {
        cb(1);
        _(() => cb(2));
        _(() => cb(3));
      })
      .store();
    const a = s1.distinct(() => true);
    const b = s1.map((vl) => vl * 10);
    const c = s1.map((vl) => vl * 11);
    stream
      .eCombine(
        [a, b],
        (vl) => vl,
        (values) => [a, b, ...values[1] === 30 ? [c] : []],
      )
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    setTimeout(() => queue1.next().done && done());
  });
});
