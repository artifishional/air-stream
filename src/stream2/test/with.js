import { stream2 as stream } from "../../index.mjs";
import {WSpring} from "../well-spring";

describe('with', function () {
/*
    test('simple', (done) => {
        const expected = [
            [1], [1, 2]
        ];
        const wsp1 = new WSpring();
        const source1 = stream(function(connect) {
            connect([wsp1])([
                wsp1.rec(1)
            ]);
        });
        const wsp2 = new WSpring();
        const source2 = stream(function(connect) {
            connect([wsp2])([
                wsp2.rec(2)
            ]);
        });
        const queue1 = expected.values();
        stream
            .with( [ source1, source2 ], () => {
                const state = new Map();
                return (updates) => {
                    updates.forEach( ([stream, data]) => state.set(stream, data) );
                    return [ ...state.values() ];
                };
            } )
            .get(e => {
                expect(e).toEqual(queue1.next().value)
            });
        queue1.next().done && done();
    });*/

    test('single source', (done) => {
        const expected = [
            ["a1", "b1"],
        ];
        const wsp = new WSpring();
        const source = stream(function(connect) {
            const e = connect([wsp]);
            setTimeout( () => e([wsp.rec(1)]) );
        })
            .endpoint();
        const pipe1 = source.map( vl => "a" + vl );
        const pipe2 = source.map( vl => "b" + vl );
        const queue1 = expected.values();
        stream
            .with( [ pipe1, pipe2 ], (own) => {
                const state = new Map();
                return (updates) => {
                    updates.forEach( ([stream, data]) => state.set(stream, data) );
                    return [ ...state.values() ];
                };
            } )
            .get(e => expect(e).toEqual(queue1.next().value));
        setTimeout( () => queue1.next().done && done() );
    });
    
});