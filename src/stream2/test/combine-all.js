import { stream2 as stream } from '../stream';
import { async } from '../../utils';

// eslint-disable-next-line no-undef
const { describe, test, expect } = globalThis;

describe('combine all', () => {
    test('simple this one lower stream', (done) => {
        const _ = async();
        const expected = [
            [10],
            [11],
        ];
        const queue1 = expected.values();
        const rc1In = stream
            .fromCbFunc((cb) => {
                cb(10);
                _(() => cb(11));
            })
            .store();
        const rc1 = stream
            .fromCbFunc((cb) => {
                _(() => cb([rc1In]));
            })
            .store();
        rc1.combineAll()
            .get(({ value }) => {
                expect(value).toEqual(queue1.next().value);
            });
        setTimeout(() => queue1.next().done && done());
    });

    test('this several lower streams', (done) => {
        const _ = async();
        const expected = [
            [10, 1],
            [20, 1],
            [20, 2],
        ];
        const queue1 = expected.values();
        const rc1In = stream
            .fromCbFunc((cb) => {
                cb(10);
                _(() => cb(20));
            })
            .store();
        const rc2In = stream
            .fromCbFunc((cb) => {
                cb(1);
                _(() => cb(2));
            })
            .store();
        const rc1 = stream
            .fromCbFunc((cb) => {
                _(() => cb([rc1In, rc2In]));
            })
            .store();
        rc1.combineAll()
            .get(({ value }) => {
                expect(value).toEqual(queue1.next().value);
            });
        setTimeout(() => queue1.next().done && done());
    });

    test('update streams list with reT4 (add new)', (done) => {
        const _ = async();
        const expected = [
            [10],
            [20],
            [10, 1],
            [20, 1],
            [20, 2],
        ];
        const queue1 = expected.values();
        const rc1In = stream
            .fromCbFunc((cb) => {
                cb(10);
                _(() => cb(20));
            })
            .store();
        rc1In.get();
        const rc2In = stream
            .fromCbFunc((cb) => {
                cb(1);
                _(() => cb(2));
            })
            .store();
        rc2In.get();
        const rc1 = stream
            .fromCbFunc((cb) => {
                _(() => cb([rc1In]));
                _(() => cb([rc1In, rc2In]));
            })
            .store();
        rc1.combineAll()
            .get(({ value }) => {
                expect(value).toEqual(queue1.next().value);
            });
        setTimeout(() => queue1.next().done && done());
    });

    test('update streams list with reT4 (del exs)', (done) => {
        const _ = async();
        const expected = [
            [10, 1],
            [20, 1],
            [20, 2],
            [10],
            [20],
        ];
        const queue1 = expected.values();
        const rc1In = stream
            .fromCbFunc((cb) => {
                cb(10);
                _(() => cb(20));
            })
            .store();
        rc1In.get();
        const rc2In = stream
            .fromCbFunc((cb) => {
                cb(1);
                _(() => cb(2));
            })
            .store();
        rc2In.get();
        const rc1 = stream
            .fromCbFunc((cb) => {
                _(() => cb([rc1In, rc2In]));
                _(() => cb([rc1In]));
            })
            .store();
        rc1.combineAll()
            .get(({ value }) => {
                expect(value).toEqual(queue1.next().value);
            });
        setTimeout(() => queue1.next().done && done());
    });

    test('update streams list with reT4 (del exs)', (done) => {
        const _ = async();
        const expected = [
            [10, 1],
            [20, 1],
            [20, 2],
            [10],
            [20],
        ];
        const queue1 = expected.values();
        const rc1In = stream
            .fromCbFunc((cb) => {
                cb(10);
                _(() => cb(20));
            })
            .store();
        rc1In.get();
        const rc2In = stream
            .fromCbFunc((cb) => {
                cb(1);
                _(() => cb(2));
            })
            .store();
        rc2In.get();
        const rc1 = stream
            .fromCbFunc((cb) => {
                _(() => cb([rc1In, rc2In]));
                _(() => cb([rc1In]));
            })
            .store();
        rc1.combineAll()
            .get(({ value }) => {
                expect(value).toEqual(queue1.next().value);
            });
        setTimeout(() => queue1.next().done && done());
    });
});
