import './globalthis';
import './queue-microtask';

if (!Array.prototype.findLast) {
  // eslint-disable-next-line no-extend-native,func-names
  Array.prototype.findLast = function (...args) {
    return this.slice().reverse().find(...args);
  };
}
