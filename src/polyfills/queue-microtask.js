import queueMicrotask from 'queue-microtask';

if(!globalThis.queueMicrotask) {
	globalThis.queueMicrotask = queueMicrotask;
}