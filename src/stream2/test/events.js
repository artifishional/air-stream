// eslint-disable-next-line import/no-extraneous-dependencies
import { stream2 as stream } from '../stream';
import { async } from '../../utils';
import { DomEvent } from './helpers';

const {
  describe, test, expect,
  // eslint-disable-next-line no-undef
} = globalThis;
const target = new DomEvent();

describe('events', () => {
  test('initialize without event', (done) => {
    const _ = async();
    const expected = [
      0,
    ];
    const queue1 = expected.values();
    stream
      .fromEvent(target, 'test-event')
      .reduce(() => 1, { local: 0 })
      .get(({ value }) => {
        expect(value).toEqual(queue1.next().value);
      });
    _(() => setTimeout(() => queue1.next().done && done()));
  });
});
