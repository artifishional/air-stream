import { stream2 as stream } from '../stream';
import { async } from '../../utils';

// eslint-disable-next-line no-undef
const { describe, test, expect } = globalThis;

describe('withlatest', () => {
  test('withlatest example', (done) => {
    // инициализация первого накопителя происходит
    // в момент распотранения соыбтия, и второй накопитель
    // еще не получил обновленное состояние
    const _ = async();
    const expected = [
      6,
    ];
    const queue1 = expected.values();
    const source = stream.fromCbFn((cb) => {
      _(() => cb({ count: 2, path: 'a' }));
      _(() => cb({ weight: 3, path: 'b' }));
    });
    const a = source
      .filter(({ path }) => path === 'a')
      .store();
    const b = source
      .filter(({ path }) => path === 'b')
      .store();
    b
      .withlatest([a], ([{ weight }, { count }]) => weight * count)
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    _(() => queue1.next().done && done());
  });
/*
  test('simple2', (done) => {
    const source = stream(null, (emt) => {
      emt({ count: 2, path: 'a' }, { type: 'reinit' });
      emt({ acc: 4, path: 'c' }, { type: 'reinit' });
      emt({ weight: 3, path: 'b' }, { type: 'reinit' });
    });
    const a = source.filter(({ path }) => path === 'a');
    const b = source.filter(({ path }) => path === 'b');
    const c = source.filter(({ path }) => path === 'c');
    let index = 0;
    b.withlatest([a, c], ({
      type, weight, path, ...args
    }, { count }, { acc }) => ({ type, ...args, total: weight * count * acc })).on((evt) => {
      expect(evt).toMatchObject([
        { total: 24 },
      ][index]);
      index++;
      if (index === 1) done();
    });
  });

  test('self-loop', (done) => {
    const source = stream(null, (emt) => {
      emt({ weight: 2, path: 'a' }, { type: 'reinit' });
      emt({ weight: 3, path: 'a' }, { type: 'reinit' });
      emt({ weight: 4, path: 'a' }, { type: 'reinit' });
    });

    const a = source.filter(({ path }) => path === 'a');
    const b = source.filter(({ path }) => path === 'a');
    const c = source.filter(({ path }) => path === 'a');

    let index = 0;

    b.withlatest([a, c, b], ({
      type, weight: a, path, ...args
    }, { weight: b }, { weight: c }, { weight: d }) => ({ type, ...args, total: a * b * c * d })).on((evt) => {
      expect(evt).toMatchObject([
        { total: 256 },
      ][index]);
      index++;
      if (index === 1) done();
    });
  });

  // test('unsubscribe', (done) => {
  //     const source = stream(null, function (emt) {
  //         emt({ weight: 2, path: "a"});
  //         emt({ weight: 3, path: "a"});
  //         emt({ weight: 3, path: "b"});
  //         emt({ weight: 4, path: "a"});
  //         return done;
  //     });
  //
  //     let a = source.filter( ({path}) => path === "a" );
  //     let b = source.filter( ({path}) => path === "a" );
  //     let c = source.filter( ({path}) => path === "a" );
  //
  //     let obs = b.withlatest([a, c, b], ({type, weight: a, path, ...args}) =>
  //         ({type, ...args})).on( e => {} );
  //     obs();
  //     expect(!source.obs.length).toEqual( 0 );
  // });*/
});
