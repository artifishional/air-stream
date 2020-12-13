import { stream2 as stream } from '../stream';

// eslint-disable-next-line no-undef
const { describe, test, expect } = globalThis;

describe('ups', () => {
  test('ups example', (done) => {
    // eslint-disable-next-line no-undef
    const proJ = jest.fn();
    const ups = stream.ups(100);
    const hook = ups.get(({ value }) => proJ(value));
    setTimeout(() => {
      expect(proJ.mock.calls).toEqual([
        [1], [2], [3], [4], [5],
      ]);
      hook();
      done();
    }, 45);
  });
});