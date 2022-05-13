import { stream2 as stream } from "../../index.mjs";
import {WSP} from "../wsp/wsp.mjs";

describe('filter', function () {
    
    test('simple', () => {
        const expected = [
            1, 3,
        ];
        const wsp = new WSP();
        const source = stream(function(connect) {
            connect([wsp])([
                wsp.rec(1), wsp.rec(2), wsp.rec(3)
            ]);
        });
        const queue1 = expected.values();
        source
            .filter( evt => evt % 2 )
            .get(e => expect(e).toEqual(queue1.next().value));
    });
    
    test('mix sources', () => {
        const expected = [
            1, 3, 5
        ];
        const wsp1 = new WSP();
        const wsp2 = new WSP();
        const source = stream(function(connect) {
            const e = connect([wsp1, wsp2]);
            e([wsp1.rec(1), wsp1.rec(2), wsp1.rec(3)]);
            e([wsp2.rec(4), wsp2.rec(5)]);
        });
        const queue1 = expected.values();
        source
            .filter( evt => evt % 2 )
            .get(e => expect(e).toEqual(queue1.next().value));
    });
    
    test('cb', () => {
        const source = stream(function(connect, control) {
            control.tocommand( (request) => {
                expect(request).toEqual("test");
            } );
            connect();
        });
        source
            .filter( evt => evt * 10 )
            .connect( (_, hook) => {
                hook( "test" );
            } );
    });
    
    test('sync disconnect', (done) => {
        const source = stream(function(connect, control) {
            control.todisconnect( () => done() );
            connect();
        });
        source
            .filter( evt => evt * 10 )
            .connect( (_, hook) => {
                hook( );
            } );
    });
    
    test('async disconnect', (done) => {
        const source = stream(function(connect, control) {
            control.todisconnect( () => done() );
            connect();
        });
        source
            .filter( evt => evt * 10 )
            .connect( (_, hook) => {
                setTimeout(() => hook( ));
            } );
    });
    
});