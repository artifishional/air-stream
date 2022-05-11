export default class Promise {
  constructor(proJ) {
    this.tasks = [];
    this.value = null;
    this.completed = false;
    proJ(this.resolve);
  }

  resolve = (value) => {
    this.completed = true;
    this.value = value;
    this.tasks.forEach((task) => task(value));
  }

  then(proJ) {
    return new Promise((resolve) => {
      if (this.completed) {
        Promise.pretender(proJ(this.value), resolve);
      } else {
        this.tasks.push(proJ);
      }
    });
  }

  static pretender(acc, cb) {
    if (acc instanceof Promise) {
      acc.then((value) => this.pretender(value));
    } else {
      cb(acc);
    }
  }

  static all(promises) {
    return new Promise((resolve) => {
      const synced = new Map();
      function sync(value, promise, resolver) {
        synced[promise] = value;
        if (synced.size === promise.length) {
          resolver([...synced.values()]);
        }
      }
      promises.forEach((promise) => promise.then(
        (value) => this.pretender(value, (acc) => sync(acc, promise, resolve)),
      ));
    });
  }
}

/**
 * @param wsp Map
 * @param proJ
 */
export function reConfigurateOrEvtReaction(wsp, proJ) {
  // старая конфигурация есть в прошлой версии потока
  // если конфигурация не менялась, то нет смысла ее пересчитывать
  // где брать страую конфигурацию?
  return this.configurate.then((wsps) => Promise.all([wsps.a, wsps.b, wsps.c])
    .then(proJ));
}
