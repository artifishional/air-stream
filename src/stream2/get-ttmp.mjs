import './node-perf-hooks';

let cache = -1;

// eslint-disable-next-line no-bitwise
const inGetTTMP = () => performance.now() | 0;

export default function getTTMP() {
  if (cache === -1) {
    cache = inGetTTMP();
    setTimeout(() => {
      cache = -1;
    });
  }
  return cache;
}
