/* eslint-disable no-undef */
if (!globalThis.performance) {
  const { performance } = require.call(globalThis, 'perf_hooks');
  globalThis.performance = performance;
}
