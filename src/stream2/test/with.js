import { stream2 as stream } from "../../index.mjs";
import {WSP} from "../wsp";
import {async} from "../../utils";

describe('with', function () {
    
    test('simple', (done) => {
        const _ = async();
        const expected = [
            [1], [1, 2]
        ];
        const wsp1 = new WSP();
        _(() => wsp1.rec(1));
        const wsp2 = new WSP();
        _(() => wsp2.rec(2));
        const queue1 = expected.values();
        new WSP( [ wsp1, wsp2 ], () => {
            const state = new Map();
            return (updates) => {
                updates.forEach( ([data, stream]) => state.set(stream, data) );
                return [ ...state.values() ];
            };
        } )
            .get(e => {
                expect(e).toEqual(queue1.next().value)
            });
        _( () => queue1.next().done && done() );
    });
    
    test('single wsp (sync mode)', (done) => {
        const _ = async();
        const expected = [
            ["a1", "b1"],
        ];
        const wsp = new WSP();
        _(() => wsp.rec(1));
        const wsp1 = wsp.map( vl => "a" + vl );
        const wsp2 = wsp.map( vl => "b" + vl );
        const queue1 = expected.values();
        new WSP( [ wsp1, wsp2 ], () => {
            const state = new Map();
            return (updates) => {
                updates.forEach( ([data, stream]) => state.set(stream, data) );
                return [ ...state.values() ];
            };
        } )
            .get(e => {
                expect(e).toEqual(queue1.next().value)
            });
        _( () => queue1.next().done && done() );
    });
    
    test('single wsp (sync mode) with empty record', (done) => {
        const _ = async();
        const expected = [
            ["a1"], ["a2"],
        ];
        const wsp = new WSP();
        _( () => wsp.rec(1) );
        _( () => wsp.rec(2) );
        const wsp1 = wsp.map( vl => "a" + vl );
        const wsp2 = wsp.filter( () => false );
        const queue1 = expected.values();
        new WSP( [ wsp1, wsp2 ], () => {
            const state = new Map();
            return (updates) => {
                updates.forEach( ([data, stream]) => state.set(stream, data) );
                return [ ...state.values() ];
            };
        } )
            .get(e => expect(e).toEqual(queue1.next().value));
        _( () => queue1.next().done && done() );
    });

    test('single wsp (sync mode) - record retention mex', (done) => {
        const _ = async();
        const expected = [
            ["a1", "b1"],
        ];
        const wsp = new WSP();
        wsp.rec(1);
        const wsp1 = wsp.map( vl => "a" + vl );
        const wsp2 = wsp.map( vl => "b" + vl );
        const queue1 = expected.values();
        new WSP( [ wsp1, wsp2 ], () => {
              const state = new Map();
              return (updates) => {
                  updates.forEach( ([data, stream]) => state.set(stream, data) );
                  return [ ...state.values() ];
              };
          } )
          .get(e => expect(e).toEqual(queue1.next().value));
        _( () => queue1.next().done && done() );
    });

    // late stream connection on several wspS

    // late stream connection on single wsp - is it real?
    // single wsp DOESN'T supp several events per frame
    // single wsp is a single wsp - it is always synchronized with itself
    // what about a stream with combined wsp?

});