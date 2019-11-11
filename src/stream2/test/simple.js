import { stream2 as stream } from '../index.mjs';
import { streamEqual, streamEqualStrict } from '../../utils';

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
  
  test('simple', (done) => {
    const expected = [
      { data: 3 },
      { data: 4 },
      { data: 2 },
    ];
    const source = stream(function (connector) {
        const e = connector();
        e(3);
        e(4);
        e(2);
    });
    streamEqualStrict(done, source, expected);
  });

  test('several connections', (done) => {
    const expected = [
      { data: 1 },
      { data: 2 },
      { data: 3 },
    ];
    const source = stream(function (connector) {
        const e = connector();
        e(1);
        e(2);
        e(3);
    });
    source.connect( () => {
        const seq = expected.values();
        return (evt) => expect(evt).toEqual(seq.next().value.data);
    } );
    streamEqual(done, source, expected);
  });

  test('log', function (done) {
      const consoleLogOrigin = console.log;
      console.log = (...args) => {
          expect(args[0]).toEqual( "test console msg" );
          consoleLogOrigin(...args);
          done();
      };
      const source = stream(function (connector) {
          const e = connector();
          e("test console msg");
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
        const source = stream(function (connector, controller) {
            controller.todisconnect(() => done());
            const e = connector();
            e(1);
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
        const source = stream(function (connector, controller) {
            controller.todisconnect(done);
            const e = connector();
            e(1);
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