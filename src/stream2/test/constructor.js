import { stream2 as stream } from '../stream';
import { async } from '../../utils';

// eslint-disable-next-line no-undef
const { describe, test, expect } = globalThis;

describe('constructor', () => {
  test('reconnect', (done) => {
    const _ = async();
    const expected = [
      1,
      2,
    ];
    const queue1 = expected.values();
    const s1 = stream
      .fromCbFunc((cb) => {
        cb(1);
        _(() => cb(2));
      });
    s1
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    _(() => setTimeout(() => {
      s1.connect(() => queue1.next().done && done());
    }));
  });
});
