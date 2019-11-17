import { stream2 as stream } from '../index.mjs';
import {WSpring} from "../well-spring";

describe('one stream', () => {
    
    test('event stream connection source', () => {
        const customEventSource = {};
        const source = stream(function(connector) {
            connector([ customEventSource ]);
        });
        source
            // ...other
            .filter( evt => evt )
            .map( evt => evt )
            // ...other
            .connect( ( [ src ] ) => {
                expect(src).toEqual( src );
                return () => {};
            } );
    });
    
    test('simple', () => {
        const expected = [
            3, 4, 2
        ];
        const wsp = new WSpring();
        const source = stream(function (connector) {
            const e = connector();
            e([wsp.rec(3), wsp.rec(4), wsp.rec(2)]);
        });
        const queue1 = expected.values();
        source.get((e) => {
            expect(e).toEqual(queue1.next().value)
        });
    });

  test('several connections', () => {
      const expected = [
          1, 2, 3
      ];
      const wsp = new WSpring();
    const source = stream(function (connector) {
        const e = connector();
        e([wsp.rec(1), wsp.rec(2), wsp.rec(3)]);
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
      const source = stream(function (connector) {
          const e = connector();
          e([wsp.rec("test console msg")]);
      });
      source.log().connect();
  });

   test('immediate disconnecting', (done) => {
    const source = stream(function (connector, controller) {
      controller.todisconnect(() => done());
      connector();
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
        const source = stream(function (connector, controller) {
            controller.todisconnect(() => done());
            const e = connector();
            e([wsp.rec(1)]);
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
        const source = stream(function (connector, controller) {
            controller.todisconnect(done);
            const e = connector();
            e([wsp.rec(1)]);
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
        const source = stream(function (connector, controller) {
            controller.todisconnect();
            controller.tocommand((req, data) => expect(data).toEqual(157));
            connector();
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