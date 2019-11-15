import { stream2 as stream } from '../index';
import { streamEqualStrict } from '../../utils';
import { LocalReducer } from '../reducer';

describe('reducer', function () {

    test('clear reducer construct with initialized stream', (done) => {
        const dataChStream = stream( (connect) => {
            connect();
        } );
        const reducer = new LocalReducer(
          dataChStream,
          ( acc, next ) => { },
          { ready: true }
        );
        streamEqualStrict(done, reducer, [
            {data: {ready: true}}
        ]);
    });

    test('simple1', (done) => {
        const dataChStream = stream((connect) => {
            const e = connect();
            e({kind: "add", vl: 1});
            e({kind: "add", vl: 2});
            e({kind: "del", vl: 3});
        } );
        const assertions = [
            {data: 0},
            {data: 1},
            {data: 3},
            {data: 0},
        ];
        const reducer = new LocalReducer(dataChStream, (acc, { kind, vl }) => {
            if(kind === "add") {
                return acc + vl;
            }
            else if(kind === "del") {
                return acc - vl;
            }
        }, 0);
        streamEqualStrict(done, reducer, assertions);
    });

    test('several subscriptions dissolved - source stream disconnect', (done) => {
        const dataChStream = stream( (connect, control) => {
            control.todisconnect( () => done() );
            const e = connect();
            e(1);
            e(2);
        } );
        const store = new LocalReducer(
          dataChStream,
          ( { count }, vl ) => ({ count: count + vl }),
          { count: 0 }
        );
        store.connect( (_, hook) => {
            return (solid) => {
                if(count === 3) {
                    debugger;
                    hook();
                }
            }
        } );
        store.connect( (_, hook) => {
            return ({ count }) => {
                if(count === 1) {
                    debugger;
                    hook();
                }
            }
        } );
	      store.connect( (_, hook) => {
            return ({ count }) => {
                debugger;
                hook();
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