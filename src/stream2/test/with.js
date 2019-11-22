import { stream2 as stream } from "../../index.mjs";
import {WSpring} from "../well-spring";

describe('with', function () {
   /*
    test('simple', () => {
        const expected = [
            [1, 2],
        ];
        const wsp = new WSpring();
        const source1 = stream(function(connect) {
            connect([wsp])([
                wsp.rec(1)
            ]);
        });
        const source2 = stream(function(connect) {
            connect([wsp])([
                wsp.rec(2)
            ]);
        });
        const queue1 = expected.values();
        stream
            .with( [ source1, source2 ], () => {
                const state = new Map();
                return (updates) => {
                    updates.forEach( ([stream, data]) =>  state.set(stream, data) );
                    return [ ...state.values() ];
                };
            } )
            .get(e => expect(e).toEqual(queue1.next().value));
    });*/
   
    test('single source', () => {
        const expected = [
            ["a1", "b1"],
        ];
        const wsp = new WSpring();
        const source = stream(function(connect) {
            connect([wsp])([
                wsp.rec(1)
            ]);
        });
        const pipe1 = source.map( vl => "a" + vl );
        const pipe2 = source.map( vl => "b" + vl );
        const queue1 = expected.values();
        stream
            .with( [ pipe1, pipe2 ], (self) => {
                const state = new Map();
                return (updates) => {
                    updates.forEach( ([stream, data]) => state.set(stream, data) );
                    return [ ...state.values() ];
                };
            } )
            .get(e => expect(e).toEqual(queue1.next().value));
    });
    
});