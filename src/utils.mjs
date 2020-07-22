// eslint-disable-next-line import/prefer-default-export
export function async() {
  let gen = Promise.resolve();
  return (next) => {
    gen = gen.then(next);
  };
}
