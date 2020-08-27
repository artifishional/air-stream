// eslint-disable-next-line import/prefer-default-export
export function async() {
  let gen = Promise.resolve();
  return (next) => {
    gen = gen.then(next);
  };
}

export function equal(a, b) {
  if (a === b) {
    return true;
  }
  if (Array.isArray(a)) {
    return a.length === b.length && a.every((x, i) => equal(x, b[i]));
  }
  if (
    typeof a === 'object' && a !== null && b !== null && a.constructor === Object
  ) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    return keysA.length === keysB.length
      && keysA.every((k) => equal(a[k], b[k]));
  }
  return false;
}
