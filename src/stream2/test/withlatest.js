import { stream2 as stream } from '../stream';
import { streamEqualStrict } from '../../utils';

describe('withLatest', function () {

    test('simple1', (done) => {

        const source = new stream(null, function (emt) {
            emt({count: 2, path: "a"});
            emt({weight: 3, path: "b"});
        });

        let a = source.filter( ({path}) => path === "a" );
        let b = source.filter( ({path}) => path === "b" );

        let index = 0;

        b.withlatest([a], ({type, weight, path, ...args}, {count}) =>
            ({type, ...args, total: weight * count})).on(evt => {
            expect(evt).toMatchObject([
                {total: 6},
            ][index]);
            index++;
            if(index === 1) done();
        });
    });

    test('simple2', (done) => {
        const source = stream(null, function (emt) {
            emt({ count: 2, path: "a"}, {type: "reinit"});
            emt({ acc: 4, path: "c"}, {type: "reinit"});
            emt({ weight: 3, path: "b"}, {type: "reinit"});
        });
        let a = source.filter( ({path}) => path === "a" );
        let b = source.filter( ({path}) => path === "b" );
        let c = source.filter( ({path}) => path === "c" );
        let index = 0;
        b.withlatest([a, c], ({type, weight, path, ...args}, {count}, {acc}) =>
            ({type, ...args, total: weight * count * acc})).on(evt => {
            expect(evt).toMatchObject([
                {total: 24},
            ][index]);
            index++;
            if(index === 1) done();
        });
    });

    test('self-loop', (done) => {

        const source = stream(null, function (emt) {
            emt({ weight: 2, path: "a"}, { type: "reinit" });
            emt({ weight: 3, path: "a"}, { type: "reinit" });
            emt({ weight: 4, path: "a"}, { type: "reinit" });
        });

        let a = source.filter( ({path}) => path === "a" );
        let b = source.filter( ({path}) => path === "a" );
        let c = source.filter( ({path}) => path === "a" );

        let index = 0;

        b.withlatest([a, c, b], ({type, weight: a, path, ...args}, {weight: b}, {weight: c}, {weight: d}) =>
            ({type, ...args, total: a * b * c * d})).on(evt => {
            expect(evt).toMatchObject([
                { total: 256 },
            ][index]);
            index++;
            if(index === 1) done();
        });
    });

    // test('unsubscribe', (done) => {
    //     const source = stream(null, function (emt) {
    //         emt({ weight: 2, path: "a"});
    //         emt({ weight: 3, path: "a"});
    //         emt({ weight: 3, path: "b"});
    //         emt({ weight: 4, path: "a"});
    //         return done;
    //     });
    //
    //     let a = source.filter( ({path}) => path === "a" );
    //     let b = source.filter( ({path}) => path === "a" );
    //     let c = source.filter( ({path}) => path === "a" );
    //
    //     let obs = b.withlatest([a, c, b], ({type, weight: a, path, ...args}) =>
    //         ({type, ...args})).on( e => {} );
    //     obs();
    //     expect(!source.obs.length).toEqual( 0 );
    // });
});