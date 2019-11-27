import { stream2 as stream } from '../index';
import { streamEqualStrict } from '../../utils';
import { LocalReducer } from '../local-reducer';
import {WSP} from "../wsp";

describe('reducer', function () {

    test('clear reducer construct with initialized stream', () => {
        const dataChStream = stream( (connect) => {
            connect([]);
        } );
        const reducer = new LocalReducer(
          dataChStream,
          ( ) => { },
          { ready: true }
        );
        const expected = [
            { ready: true },
        ];
        const queue1 = expected.values();
        reducer.get((e) => expect(e).toEqual(queue1.next().value));
    });

    test('simple1', () => {
        const wsp = new WSP();
        const dataCh = stream((connect) => {
            connect([wsp])([
                wsp.rec({kind: "add", vl: 1}),
                wsp.rec({kind: "add", vl: 2}),
                wsp.rec({kind: "del", vl: 3}),
            ]);
        } );
        const expected = [
            0, 1, 3, 0
        ];
        const reducer = new LocalReducer(dataCh, (acc, { kind, vl }) => {
            if(kind === "add") {
                return acc + vl;
            }
            else if(kind === "del") {
                return acc - vl;
            }
        }, 0);
        const queue1 = expected.values();
        reducer.get((e) => expect(e).toEqual(queue1.next().value));
    });

    test('several subscriptions dissolved - source stream disconnect', (done) => {
        const wsp = new WSP();
        const dataCh = stream( (connect, control) => {
            control.todisconnect( () => done() );
            connect([wsp])([
                wsp.rec(1),
                wsp.rec(2)
            ]);
        } );
        const store = new LocalReducer(
            dataCh,
          ( { count }, vl ) => ({ count: count + vl }),
          { count: 0 }
        );
        store.connect( (_, hook) => {
            return (solid) => {
                solid.map( ({value: { count }}) => {
                    if(count === 3) {
                        hook();
                    }
                } );
            }
        } );
        store.connect( (_, hook) => {
            return (solid) => {
                solid.map( ({value: { count }}) => {
                    if(count === 1) {
                        hook();
                    }
                } );
            }
        } );
        store.connect( (_, hook) => {
            return (solid) => {
                solid.map( ({value: { count }}) => {
                    if(count === 0) {
                        hook();
                    }
                } );
            }
        } );
    });

    /*
   Подписка к редьюсеру, отписка
   Повторная подписка - начальное состояние не должно сохраниться
   так как может использоваться empty object state

   const test = stream2( null, (e) => {
	e(10);
	//setTimeout( () => e(10) );
} ).store();

let hook1 = null;
test.connect( (hook) => {
	hook1 = hook;
	return console.log;
} );

hook1();

test.connect( (hook) => {
	hook1 = hook;
	return console.log;
} );

hook1();
/*
test.connect( (hook) => {
	hook1 = hook;
	return console.log;
} );

hook1();*/


/*
    it('abort action', (done) => {

        done = series(done, [
            evt => expect(evt).to.deep.equal( keyF ),
            evt => expect(evt).to.deep.equal( 0 ),
            evt => expect(evt).to.deep.equal( 1 ),
            evt => expect(evt).to.deep.equal( 3 ),
            evt => expect(evt).to.deep.equal( 6 ),
            evt => expect(evt).to.deep.equal( keyF ),
            evt => expect(evt).to.deep.equal( 5 ),
            evt => expect(evt).to.deep.equal( 9 ),
        ]);

        const source = new Observable( function (emt) {
            emt.kf();
            emt(0, { rid: 0 });
            emt(1, { rid: 1 });
            emt(2, { rid: 2 });
            emt(3, { rid: 3 });
            setTimeout(() => {
                emt(keyA, { is: { abort: true }, rid: 1 });
                emt(4, { rid: 4 });
            }, 0);
        } );

        source
            .reducer( (acc, next) => {
                return acc + next;
            } )
            .on( done );

    });
*/
/*
    it('refresh history', (done) => {

        done = series(done, [
            evt => expect(evt).to.deep.equal( keyF ),
        ]);

        const source = new Observable( function (emt) {
            emt.kf();
            emt(0, { rid: 0 });
            emt(1, { rid: 1 });
            emt(2, { rid: 2 });
            emt(3, { rid: 3 });
            emt.kf();
            emt(keyA, { is: { abort: true }, rid: 1 });
        } );

        source
            .reducer( (acc, next) => {
                return acc + next;
            } )
            .on( done );

    });*/

});