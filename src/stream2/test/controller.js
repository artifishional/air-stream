// eslint-disable-next-line import/no-extraneous-dependencies
import EventEmitter from 'event-emitter';
import { stream2 as stream } from '../stream';
import { async } from '../../utils';

const {
  describe, test, expect,
  // eslint-disable-next-line no-undef
} = globalThis;

describe('controller', () => {
  test('fromCbFn constructor method', (done) => {
    const _ = async();
    const expected = [
      10,
      100,
      1000,
    ];
    const queue1 = expected.values();
    const res = stream
      .fromCbFn((cb, ctr) => {
        ctr.req('change', (data) => {
          cb(data);
        });
        cb(10);
      });
    const hook = res.get(({ value }) => {
      expect(value).toEqual(queue1.next().value);
    });
    _(() => hook('change', 100));
    _(() => hook('change', 1000));
    _(() => queue1.next().done && done());
  });

  test('simple sync callback', (done) => {
    const _ = async();
    const expected = [
      10,
    ];
    const queue1 = expected.values();
    _(() => {
      const res = stream
        .handle(() => ({
          change(request, { value }) {
            return value;
          },
        }))
        .map((value) => value * 10);
      res
        .requester((req) => {
          req('change', { value: 1 });
        })
        .connect();
      res.get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    });
    _(() => queue1.next().done && done());
  });

  test('simple disconnect', (done) => {
    const _ = async();
    const expected = [
      20,
    ];
    const queue1 = expected.values();
    const target = new EventEmitter();
    const rc = stream.fromNodeEvent(
      target,
      'test-event',
      (vl) => vl,
    );
    _(() => target.emit('test-event', 2));
    _(() => target.emit('test-event', 3));
    let hook = null;
    const res = rc
      .map((value) => value * 10)
      .map((value) => {
        hook();
        expect(value).toEqual(queue1.next().value);
        return 0;
      });
    hook = res.connect();
    _(() => queue1.next().done && done());
  });
});
