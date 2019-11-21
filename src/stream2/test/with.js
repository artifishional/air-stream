import { stream2 as stream } from "../../index.mjs";
import {WSpring} from "../well-spring";

describe('with', function () {
    
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
            .with( [ source1, source2 ], (stream) => {
                let state = new Map();
                return (data, /*... if synced*/) => {
                    state.set(stream, data);
                    return [ ...state.values() ];
                };
            } )
            .get(e => expect(e).toEqual(queue1.next().value));
    });
    
});