/* eslint-disable no-undef */
import queueMicrotask from 'queue-microtask';

if (!globalThis.queueMicrotask) {
  globalThis.queueMicrotask = queueMicrotask;
}
