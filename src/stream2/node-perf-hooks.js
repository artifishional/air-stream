if (!globalThis.performance) {
  const { performance } = require('perf_hooks');
  globalThis.performance = performance;
}
