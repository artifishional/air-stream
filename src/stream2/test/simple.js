import { stream2 as stream } from '../index.mjs';
import {WSpring} from "../well-spring";

describe('one stream', () => {
    
    test('event stream connection source', (done) => {
        const wsp = new WSpring();
        const source = stream(function(connect) {
            connect([ wsp ]);
        });
        source
            // ...other
            .filter( evt => evt )
            .map( evt => evt )
            // ...other
            .connect( ( [ src ] ) => {
                done();
                return () => {};
            } );
    });
    
    test('Throw: WSpring event sources only supported', () => {
        const wsp = new WSpring();
        const source = stream(function(connect) {
            connect([ {} ])([
                wsp.rec(3)
            ]);
        });
        expect(() => {
            source.connect( ( ) => () => {} );
        }).toThrow( new TypeError("WSpring event sources only supported") );
    });
    
    test('Throw: Zero spring chanel produced some data?', () => {
        const wsp = new WSpring();
        const source = stream(function(connect) {
            const e = connect();
            e([wsp.rec(3)]);
        });
        expect(() => {
            source.connect( ( ) => () => {} );
        }).toThrow( new TypeError("Zero spring chanel produced some data?") );
    });
    
    test('simple', () => {
        const expected = [
            3, 4, 2
        ];
        const wsp = new WSpring();
        const source = stream(function (connect) {
            connect([wsp])([
                wsp.rec(3), wsp.rec(4), wsp.rec(2)
            ]);
        });
        const queue1 = expected.values();
        source.get(e => expect(e).toEqual(queue1.next().value));
    });

  test('several connections', () => {
      const expected = [
          1, 2, 3
      ];
      const wsp = new WSpring();
    const source = stream(function (connect) {
        connect( [wsp] )([
            wsp.rec(1), wsp.rec(2), wsp.rec(3)
        ]);
    });
      const queue1 = expected.values();
      source.get((e) => {
          expect(e).toEqual(queue1.next().value)
      });
      const queue2 = expected.values();
      source.get((e) => {
          expect(e).toEqual(queue2.next().value)
      });
  });

  test('log', function () {
      const consoleLogOrigin = console.log;
      console.log = (...args) => {
          expect(args[0]).toEqual( "test console msg" );
          consoleLogOrigin(...args);
      };
      const wsp = new WSpring();
      const source = stream(function (connect) {
          const e = connect([wsp]);
          e([wsp.rec("test console msg")]);
      });
      source.log().connect();
  });

   test('immediate disconnecting', (done) => {
    const source = stream(function (connect, controller) {
      controller.todisconnect(() => done());
      connect();
    });
    source
        // ...other
        .filter( evt => evt )
        .map( evt => evt )
        // ...other
        .connect( (evtStreamsSRC, hook) => hook());
  });
    
    test('disconnecting after first msg', (done) => {
        const wsp = new WSpring();
        const source = stream(function (connect, controller) {
            controller.todisconnect(() => done());
            connect([wsp])([
                wsp.rec(1)
            ]);
        });
        source
            // ...other
            .filter( evt => evt )
            .map( evt => evt )
            // ...other
            .connect( (_, hook) => () => {
                hook();
            });
    });
    
    test('several disconnecting', (done) => {
        function doneCounter(count, done) {
            return () => !--count && done();
        }
        done = doneCounter(2, done);
        const wsp = new WSpring();
        const source = stream(function (connect, controller) {
            controller.todisconnect(done);
            connect([wsp])([
                wsp.rec(1)
            ]);
        });
        source
        // ...other
            .filter( evt => evt )
            .map( evt => evt )
            // ...other
            .connect( (_, hook) => () => {
                hook();
            });
        source
        // ...other
            .filter( evt => evt )
            .map( evt => evt )
            // ...other
            .connect( (_, hook) => () => {
                hook();
            });
    });
    
    test('cb controller', () => {
        const source = stream(function (connect, controller) {
            controller.todisconnect();
            controller.tocommand((req, data) => expect(data).toEqual(157));
            connect();
        });
        source
        // ...other
            .filter( evt => evt )
            .map( evt => evt )
            // ...other
            .connect( (_, hook) => {
                hook("$", 157);
            });
    });
  
});