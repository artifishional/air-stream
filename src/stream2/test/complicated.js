import { stream2 as stream } from '../index';
import {series} from "../../utils.mjs";
import { async } from '../../utils';
import { WSP } from '../wsp';


class Socket {

    constructor() {
        this.obs = [];
    }

    on( obs ) {
        this.obs.push( obs );
        setTimeout( () => obs( {
            action: "initialize",
            state: {
                mass: [1, 5, 6, 7, 20],
                rnm: 2
            }
        } ) );
    }

    off( obs ) {
        this.obs.splice( this.obs.indexOf(obs), 1 );
    }

    send(data) {
        setTimeout( () => this.obs.map( obs => obs( data ) ) );
    }

}
/*
describe('1.', function () {

    it('a)', (done) => {

        const srv = new Observable(function ({ push }) {

            const socket = new Socket();
            socket.on( function ( {action, __sid__ = -1, ...data} ) {

                if(action === "ok") {
                    push(  );
                }

            } );

            return ( {action, data} ) => {
                socket.send( { action, ...args } );
            }
        });

    });

});*/

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
    });*/


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
    });


});