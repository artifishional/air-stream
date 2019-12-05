import { stream2 as ch } from "../../index.mjs";
import {WSP} from "../wsp";

describe('map', function () {
    
    test('simple', () => {
        const expected = [
            10, 20, 30,
        ];
        const wsp = new WSP();
        const source = ch(connect => connect(wsp));
        const queue1 = expected.values();
        source
            .map( evt => evt * 10 )
            .get( e => expect(e).toEqual(queue1.next().value) );
    });
    
    test('mix sources', () => {
        const expected = [
            10, 20, 30, 40, 50
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
            .map( evt => evt * 10 )
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
            .map( evt => evt * 10 )
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
            .map( evt => evt * 10 )
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
            .map( evt => evt * 10 )
            .connect( (_, hook) => {
                setTimeout(() => hook( ));
            } );
    });
    
});