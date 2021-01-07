import WSP from '../wsp';
import RedWSP from '../rwsp';

// eslint-disable-next-line no-undef
const { describe, test, expect } = globalThis;

describe('WSP', () => {
  test('WSP-slave sources', () => {
    const s1 = WSP.create(null, null);
    const c1 = WSP.create([s1], null);
    expect(c1.originWSPs.size).toEqual([
      expect(c1.originWSPs.has(s1)).toBeTruthy(),
      expect(c1.originWSPs.has(RedWSP.STATIC_LOCAL_WSP)).toBeTruthy(),
    ].length);
  });

  test('RED-master sources', () => {
    const s1 = WSP.create(null, null);
    const r1 = RedWSP.create([s1]);
    expect(r1.originWSPs.size).toEqual([
      expect(r1.originWSPs.has(s1)).toBeTruthy(),
      expect(r1.originWSPs.has(r1)).toBeTruthy(),
      expect(r1.originWSPs.has(RedWSP.STATIC_LOCAL_WSP)).toBeTruthy(),
    ].length);
  });
});
