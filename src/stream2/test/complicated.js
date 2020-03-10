import { stream2 as stream } from '../index';
import { async } from '../../utils';
import Propagate from '../propagate';

// eslint-disable-next-line no-undef
const { describe, test, expect } = globalThis;

describe('complicated', () => {
  test('Classic combine from several source', (done) => {
    const _ = async();
    const expected = [
      [0, 10],
      [2, 10],
      [2, 14],
      [5, 14],
      [5, 20],
    ];
    const queue1 = expected.values();
    let cb1;
    const rc1 = stream.fromCbFunc((_cb1) => {
      cb1 = _cb1;
    });
    let cb2;
    const rc2 = stream.fromCbFunc((_cb2) => {
      cb2 = _cb2;
    });
    _(() => {
      cb1(2);
      cb2(2);
    });
    _(() => {
      cb1(3);
      cb2(3);
    });
    const red1 = rc1
      .reduce(() => (acc, next) => acc + next, { local: 0 });
    const red2 = rc2
      .reduce(() => (acc, next) => acc + next * 2, { local: 10 });
    stream
      .with([red1, red2],
        () => (updates, combined) => combined.map(({ value }) => value))
      .get(({ value }) => expect(value).toEqual(queue1.next().value));
    _(() => queue1.next().done && done());
  });

  test('Connecting with ret4 after full message queue from the same source', (done) => {
    const _ = async();
    const expected = [
      [2, 14],
      [5, 20],
    ];
    const queue1 = expected.values();
    const rc = stream.fromCbFunc((cb) => {
      _(() => cb(2));
      _(() => cb(3));
    });
    const red1 = rc
      .reduce(() => (acc, next) => acc + next, { local: 0 });
    const red2 = rc
      .reduce(() => (acc, next) => acc + next * 2, { local: 10 });
    red1.get();
    red2.get();
    _(() => {
      stream
        .with([red1, red2],
          () => (updates, combined) => combined.map(({ value }) => value))
        .get(({ value }) => expect(value).toEqual(queue1.next().value));
    });
    _(() => queue1.next().done && done());
  });

  test('Connecting with ret4 from the same source', (done) => {
    const _ = async();
    const expected = [
      [0, 10],
      [2, 14],
      [5, 20],
    ];
    const queue1 = expected.values();
    const rc = stream.fromCbFunc((cb) => {
      _(() => cb(2));
      _(() => cb(3));
    });
    const red1 = rc
      .reduce(() => (acc, next) => acc + next, { local: 0 });
    const red2 = rc
      .reduce(() => (acc, next) => acc + next * 2, { local: 10 });
    stream
      .with([red1, red2],
        () => (updates, combined) => combined.map(({ value }) => value))
      .get(({ value }) => expect(value).toEqual(queue1.next().value));
    _(() => queue1.next().done && done());
  });

  test('Cancel queue event with ret4 from the same source', (done) => {
    const _ = async();
    const expected = [
      [0, 10],
      [2, 14],
      [5, 20],
    ];
    const queue1 = expected.values();
    const rc = stream.fromCbFunc((cb) => {
      _(() => cb(-2));
      _(() => cb(3));
    });
    const red1 = rc
      .reduce(() => (acc, next) => {
        if (next < 0) {
          Propagate.interrupt({ msg: "Don't use unexpected values" });
          return acc;
        }
        return acc + next;
      }, { local: 0 });
    const red2 = rc
      .reduce(() => (acc, next) => acc + next * 2, { local: 10 });
    stream
      .with([red1, red2],
        () => (updates, combined) => combined.map(({ value }) => value))
      .get(({ value }) => expect(value).toEqual(queue1.next().value));
    _(() => queue1.next().done && done());
  });
});
