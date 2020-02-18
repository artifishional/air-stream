import { stream2 as stream } from '../index';
import { async } from '../../utils';

// eslint-disable-next-line no-undef
const { describe, test, expect } = globalThis;

describe('complicated', () => {
  test('classic combine from the same source', (done) => {
    debugger;
    const _ = async();
    const expected = [
      [0, 10],
      [2, 14],
      [5, 20],
    ];
    const queue1 = expected.values();
    const rc = stream.fromCbFunc((cb) => {
      _(() => {
        debugger;
        cb(2);
      });
      _(() => cb(3));
    });
    const red1 = rc
      .reduce(() => (acc, next) => acc + next, { local: 0 });
    const red2 = rc
      .reduce(() => (acc, next) => acc + next * 2, { local: 10 });
    stream
      .with([red1, red2],
        (/* owner */) => (updates, combined) => {
          debugger;
          return combined.map(({ value }) => value);
        })
      .get(({ value }) => expect(value).toEqual(queue1.next().value));
    _(() => queue1.next().done && done());
  });

  /*
describe('complicated', function () {
    /*test('stream reopening', (done) => {
        done = series(done, [
            evt => expect(evt).toEqual( "a1" ),
            evt => expect(evt).toEqual( "b2" ),
            evt => expect(evt).toEqual( "c3" ),
            evt => expect(evt).toEqual( "d4" ),
            evt => expect(evt).toEqual( "a1" ),
            evt => expect(evt).toEqual( "b2" ),
            evt => expect(evt).toEqual( "c3" ),
            evt => expect(evt).toEqual( "d4" ),
        ]);
        const source = stream( null, emt => {
            emt("a1");
            emt("b2");
            emt("c3");
            emt("d4");
        } );
        const hook = source.on( done );
        setTimeout(() => {
            hook();
            source.on( done );
        }, 10);
    });


    //изменение порядка
    //отмена

    test("slave mixed type storage combinator with retouch", (done) => {

        const _ = async();
        const expected = [
            ["a1", "b1"],
        ];
        const wsp1 = new RWSP(rt4);
        wsp1.rec(2);

        const wsp2 = new RWSP(rt4);
        wsp2.rec(1);

        const queue1 = expected.values();
        new RsWSP( [ wsp1, wsp2 ], () => {
            const state = new Map();
            return (updates) => {
                updates.forEach( ([data, stream]) => state.set(stream, data) );
                return [ ...state.values() ];
            };
        } )
          .get(e => expect(e).toEqual(queue1.next().value));
        _( () => queue1.next().done && done() );
    }); */
});
