import { stream2 as stream } from '../stream';
import { async } from '../../utils';
import RedWSP from "../rwsp";
import Record from "../record/record";
import STTMP from "../sync-ttmp-ctr";
import {
  RED_REC_LOCALIZATION,
  RED_REC_STATUS,
  RED_REC_SUBORDINATION,
  RedRecord,
} from '../record/red-record';

// eslint-disable-next-line no-undef
const { describe, test, expect } = globalThis;

describe('combine', () => {
  /*test('example', (done) => {
    const _ = async();
    const expected = [
      200,
      220,
      242,
    ];
    const queue1 = expected.values();
    const rc1 = stream.fromCbFunc((cb) => {
      cb(10);
      _(() => cb(11));
    });
    const rc2 = stream.fromCbFunc((cb) => {
      cb(20);
      _(() => cb(22));
    });
    stream.combine([rc1, rc2], ([vl1, vl2]) => vl1 * vl2)
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
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
    const rc = stream.fromCbFunc((cb) => {
      cb(10);
      _(() => cb(11));
    });
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
    const rc = stream.fromCbFunc((cb) => {
      cb(10);
      _(() => cb(11));
    });
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
    const rc = stream.fromCbFunc((cb) => {
      cb([]);
    });
    stream.combine([rc], ([vl1]) => vl1)
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    _(() => queue1.next().done && done());
  });

  test('several remote RedWSP to local RedSWPSlave', (done) => {
    const _ = async();
    const expected = [
      1020,
      1122,
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
    const res = stream.combine([r1, r2], ([vl1, vl2]) => vl1 * vl2);
    res.get(({ value }) => {
      expect(value).toEqual(queue1.next().value);
    });
    setTimeout(() => _(() => queue1.next().done && done()));
  });
*/
  
  test('head combineAllFirst example', (done) => {
    const _ = async();
    const expected = [
      [10, 20],
    ];
    const queue1 = expected.values();
    stream
      .fromCbFunc((headCb) => {
        _(() => headCb([
          stream.fromCbFunc((cb) => {
            _(() => cb(10));
          }),
          stream.fromCbFunc((cb) => {
            _(() => cb(20));
          }),
        ]));
      })
      .combineAllFirst()
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    setTimeout(() => queue1.next().done && done());
  });
  
   /*
     test('empty source combiner', (done) => {
       const combined = stream.combine([]);
       streamEqualStrict(done, combined, [ { data: [] } ]);
     });
   
       test('to many streams', (done) => {
           const a = stream(null, function (emt) {
               emt("a");
               emt("b");
               emt("c");
               setTimeout(() => emt("d"), 10);
           });
           const b = stream(null, function (emt) {
               emt("c");
               emt("d");
               setTimeout(() => emt("e"), 10);
           });
           const c = stream(null, function (emt) {
               emt("c");
               setTimeout(() => emt("d"), 10);
           });
           const d = stream(null, function (emt) {
               emt("a");
               emt("b");
               emt("d");
           });
           streamEqualStrict(
               done,
               stream.combine([a, b, c, d].map(obs => obs.filter(v => v === "d"))),
               [{data: ["d", "d", "d", "d"]}],
           );
       });
   
       test('loop', (done) => {
           const assertions = [
               // {data: ["b1", "b", "b"]},
               {data: ["b1", "b", "c"]},
               {data: ["c1", "b", "c"]},
           ];
           const source = stream(null, function (emt) {
               emt("a");
               emt("b");
               emt("c");
           });
           const a = source.map( evt => evt + "1");
           const b = source.filter( evt => evt === "b");
           streamEqualStrict(done, stream.combine([a, b, source] ), assertions);
       });
   
       // test('combine key', (done) => {
       //
       //     done = series(done, [
       //         evt => expect(evt).to.deep.equal(keyF),
       //     ]);
       //
       //     const source = stream(function (emt) {
       //         emt.kf();
       //     });
       //
       //     const a = source.filter( ({path}) => path === "a" );
       //     const b = source.filter( ({path}) => path === "b" );
       //
       //     combine([a, b], ({count: a}, {count: b}) => [a, b] ).on( done );
       //
       // });*/
});