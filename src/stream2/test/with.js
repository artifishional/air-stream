import { stream2 as stream } from "../../index.mjs";
import {WSP} from "../wsp";

describe('with', function () {

    test('simple', (done) => {
        const expected = [
            [1], [1, 2]
        ];
        const wsp1 = new WSP();
        const source1 = stream(function(connect) {
            const e = connect([wsp1]);
            queueMicrotask(() => e(wsp1.rec(1)));
        });
        const wsp2 = new WSP();
        const source2 = stream(function(connect) {
            const e = connect([wsp2]);
            queueMicrotask(() => e(wsp2.rec(2)));
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
                expect(e).toEqual(queue1.next().value);
            });
        queueMicrotask( () => queue1.next().done && done() );
    });
    
    test('single wsp (sync mode)', (done) => {
        const expected = [
            ["a1", "b1"],
        ];
        const wsp = new WSP();
        const source = stream(function(connect) {
            const e = connect([wsp]);
            queueMicrotask( () => e(wsp.rec(1)) );
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
        queueMicrotask( () => queue1.next().done && done() );
    });
    
    test('single wsp (sync mode) with empty record', (done) => {
        const expected = [
            ["a1"], ["a2"],
        ];
        const wsp = new WSP();
        const source = stream(function(connect) {
            const e = connect([wsp]);
            queueMicrotask( () => e(wsp.rec(1)) );
            queueMicrotask( () => e(wsp.rec(2)) );
        })
            .endpoint();
        const pipe1 = source.map( vl => "a" + vl );
        const pipe2 = source.filter( () => false );
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
        queueMicrotask( () => queue1.next().done && done() );
    });
    
    //record retention mex on endpoints with single wsp
    
});