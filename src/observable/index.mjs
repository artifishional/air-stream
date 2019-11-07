import Queue from './queue.mjs';
import Stack from './stack.mjs';
import globals from './globals.mjs';

/**
 * reinit можно отправлять несолкьо раз, и он теперь не обновляет очередь,
 * для полного обновления нужно сделать полный реистанс модели
 *
 * filter не заботится о сохранности reinit для инициализации потока
 *
 * сохранность $SID должна гарантироваться извне
 */

const stacks = [];
const QUEUE = new Queue();

const { freeze } = Object;

export const keyF = freeze({ keyF: 'keyF' });
export const keyA = freeze({ keyA: 'keyA' });
export const empty = freeze({ empty: 'empty' });

export default class Observable {

  constructor (emitter) {
    this.obs = [];
    this.emitter = emitter;
    this.queue = [];
    this.processed = [];
    this.init = false;

    const emt = (evt, src) => this.emit(evt, src);
    emt.emit = emt;
    emt.emt = emt;
    emt.kf = () => this.emit(keyF);
    this.emt = emt;

  }

  static merge (connectable, unconnectable, project) {
    return new Observable(emt => {
      const _connectable = connectable.map(x => x.on(

      ));
      const _unconnectable = [unconnectable.map(x => x.on(

      ))];
      return ({ dissolve, ...args }) => {
        if (dissolve) {
          [..._connectable, ..._unconnectable].map(x => x());
        } else {
          _connectable.map(x => x(args));
        }
      };
    });
  }

  static merge (connectable, unconnectable, project = evt => evt) {
    return new Observable(emt =>

      ['tail',

        connectable.map(obs => obs.on((evt, src) => {

          if (evt === keyF && connectable.every(({ queue }) => queue.length === 1)) {
            return emt(evt, src);
          }

          if (evt !== keyF && connectable.every(({ queue }) => queue.length >= 1)) {
            return emt(project(evt, src), src);
          }

        })),

        unconnectable.map(obs => obs.on((evt, src) => {

          if (evt !== keyF && connectable.every(({ queue }) => queue.length >= 1)) {
            return emt(project(evt, src), src);
          }

        })),

      ]
    );
  }

  static project (...args) { return args; }

  static combine (observables = [], project = Observable.project) {

    if (!observables.length) {
      return new Observable(emt => emt(project()));
    }

    //if(!observables.length) throw `observables must be an array of length at least 1`;
    return new Observable(emt => {
      observables = observables.map(obs => {
        if (obs.queue.length > 1) {
          return Observable.from(obs);
        }
        return obs;
      });
      const tails = observables.map(obs => obs.on((evt, src) => {
        if (evt === keyF && observables.every(obs => obs.init)) {
          return emt(evt, src);
        }
        const events = observables.map(obs => obs.queue);
        if (events.every(evt => evt.length > 1)) {
          const _events = events.map(evt => evt.slice(-1)[0][0]);
          _events.splice(observables.indexOf(obs), 1, evt);

          if (_events.some(({ keyF }) => keyF)) {
            throw `may by a several instances of air-stream is loaded?`;
          }

          emt(project(..._events), src);
        }
      }));
      return (...args) => tails.forEach(tail => tail(...args));
    });
  }

  static from (obs) {
    return new Observable(emt => obs.on(emt));
  }

  static fromPromise(source) {
    return new Observable((e) => {
      source.then( e );
    });
  }

  static sync (streams, equal, poject = Observable.project) {
    return Observable
      .combine(streams)
      .withHandler((emt, streams) => {
        if (streams.length > 1) {
          if (streams.every(stream => equal(streams[0], stream))) {
            emt(poject(...streams));
          }
        } else if (streams.length > 0) {
          if (equal(streams[0], streams[0])) {
            emt(poject(...streams));
          }
        } else {
          emt(poject());
        }
      });
  }

  connectable (obs, { full = false } = {}) {
    if (full) obs = (...args) => !keys.includes(args[0]) && obs(...args);
    const res = ({ dissolve = false, ...args } = { dissolve: true }) => {
      if (dissolve) {
        const cut = this.obs.indexOf(obs);
        /*<@>*/
        if (cut < 0) throw `attempt to delete an observer out of the container`;/*</@>*/
        this.obs.splice(cut, 1);
        if (!this.obs.length) {
          this.init = false;
          this.queue.length = 0;
          this.clearProcessed();
        }
        if (this._disconnect) {
          if (!this.obs.length) {
            if (Array.isArray(this._disconnect) && this._disconnect[0] === 'tail') {
              [...this._disconnect[1], ...this._disconnect[2]].map(tail => tail());
            } else {
              Array.isArray(this._disconnect) ?
                this._disconnect.map(tail => tail({ dissolve })) : this._disconnect({ dissolve });
            }
          }
        }
      } else {

        if (Array.isArray(this._disconnect) && this._disconnect[0] === 'tail') {
          this._disconnect[1].map(tail => tail(args));
        } else {
          Array.isArray(this._disconnect) ?
            this._disconnect.map(dis => dis(args)) : this._disconnect && this._disconnect(args);
        }
      }
    };
    res.connect = () => this.on(obs);
    return res;
  }

  on (obs) {
    /*<@>*/
    if (typeof obs !== 'function') throw `first argument 'obs' must be a function`; /*</@>*/
    this.obs.push(obs);
    if (this.obs.length === 1) {
      this._disconnect = this.emitter(this.emt) || null;
    }
    this.queue.map(evt => obs(...evt));
    return ({ dissolve = false, ...args } = { dissolve: true }) => {
      if (dissolve) {
        const cut = this.obs.indexOf(obs);
        /*<@>*/
        if (cut < 0) throw `attempt to delete an observer out of the container`;/*</@>*/
        this.obs.splice(cut, 1);
        if (!this.obs.length) {
          this.init = false;
          this.queue.length = 0;
          this.clearProcessed();
        }
        if (this._disconnect) {
          if (!this.obs.length) {
            if (Array.isArray(this._disconnect) && this._disconnect[0] === 'tail') {
              [...this._disconnect[1], ...this._disconnect[2]].map(tail => tail());
            } else {
              Array.isArray(this._disconnect) ?
                this._disconnect.map(tail => tail({ dissolve })) : this._disconnect({ dissolve });
            }
          }
        }
      } else {

        if (Array.isArray(this._disconnect) && this._disconnect[0] === 'tail') {
          this._disconnect[1].map(tail => tail(args));
        } else {
          Array.isArray(this._disconnect) ?
            this._disconnect.map(dis => dis(args)) : this._disconnect && this._disconnect(args);
        }
      }
    };
  }

  at (obs) {
    return this.on((...args) => !keys.includes(args[0]) && obs(...args));
  }

  clearProcessed () {
    this.processed.map(({ stack, act }) => {
      stack.cuts(act);
    });
    this.processed.length = 0;
  }

  emit (data, { __sid__ = -1, is = {}, rid = -1 } = {}) {
    if (__sid__ === -1) {
      __sid__ = globals.SID;
    }
    const stack = stacks[__sid__] || (stacks[__sid__] = new Stack({ __sid__, queue: QUEUE }));

    if (!this.init && data !== keyF) {
      this.emit(keyF, { __sid__ });
    }

    this.init = true;

    /*<@>*/
    if (data === undefined) throw `attempt to emit 'undefined' data`;/*</@>*/

    if (data === keyF) {
      this.clearProcessed();
    }

    const evt = [data, { __sid__, is, rid }];

    const act = () => {
      if (data === keyF) this.queue.length = 0;
      this.queue.push(evt);
      const cut = this.processed.findIndex(({ act: x }) => x === act);
      /*<@>*/
      if (cut < 0) throw `attempt to delete an event out of the processed queue`;/*</@>*/
      this.processed.splice(cut, 1);
      this.obs.map(obs => obs(...evt));
    };

    this.processed.push({ act, stack });
    stack.push(act);

  }

  connected () {
    return new Observable(emt => {
      let _connected = false;
      return this.on(() => {
        if (!_connected) {
          _connected = true;
          emt.kf();
        }
      });
    });
  }

  /**
   * 1 - новое событие от инициатора
   *
   * 2 - новое событие от ведомого
   * @param observables
   * @param project
   * @return Observable
   */
  withLatestFrom (observables = [], project = (...args) => args) {
    return new Observable(emt => {
      const tails = [];

      function check (evt, src) {
        const mess = observables.map(obs => {
          const last = obs.queue.length && obs.queue.slice(-1)[0];
          return last && last.__sid__ <= src.__sid__ ? last : null;
        });
        if (mess.every(msg => msg)) {
          emt({ ...project(evt, ...mess) }, src);
        }
      }

      //если изменение из пассивов
      observables.forEach(obs => tails.push(obs.on(evt => {
        //только если стволовой поток инициализирован
        //и текущий поток еще не был задействован
        if (this.queue.length && obs.queue.length === 1) {
          check(...this.queue.slice(-1)[0]);
        }
      })));
      //если изменение от источника событий
      tails.push(this.on(check));
      return (...args) => tails.map(tail => tail(...args));
    });
  }

  withlatest (observables = [], project = (...args) => args) {
    return new Observable(emt => {
      const tails = [];

      function check (evt, src) {

        if (keys.includes(evt)) {
          return emt(evt, src);
        }

        const mess = observables.map(obs => {
          const last = obs.queue.slice().reverse().find(([evt]) => !keys.includes(evt));
          return last && last[1].__sid__ <= src.__sid__ ? last[0] : null;
        });
        if (mess.every(msg => msg)) {
          emt(project(evt, ...mess), src);
        }
      }

      //если изменение из пассивов
      observables.forEach(obs => tails.push(obs.on(evt => {
        //только если стволовой поток инициализирован
        //и текущий поток еще не был задействован
        if (this.queue.length && obs.queue.length === 1) {
          check(...this.queue.slice(-1)[0]);
        }
      })));
      //если изменение от источника событий
      tails.push(this.on(check));
      return (...args) => tails.map(tail => tail(...args));
    });
  }

  withLatest (observables = [], project = (...args) => args) {
    return new Observable(emt => {
      const tails = [];

      function check (evt, src) {

        if (evt === keyF) {
          return emt(evt, src);
        }

        const mess = observables.map(obs => {
          const last = obs.queue.slice().reverse().find(([evt]) => !keys.includes(evt));
          return last && last[1].__sid__ <= src.__sid__ ? last[0] : null;
        });
        if (mess.every(msg => msg)) {
          emt([...project(evt, ...mess)], src);
        }
      }

      //если изменение из пассивов
      observables.forEach(obs => tails.push(obs.on(evt => {
        //только если стволовой поток инициализирован
        //и текущий поток еще не был задействован
        if (this.queue.length && obs.queue.length === 1) {
          check(...this.queue.slice(-1)[0]);
        }
      })));
      //если изменение от источника событий
      tails.push(this.on(check));
      return (...args) => tails.map(tail => tail(...args));
    });
  }

  ready () {
    let ready = false;
    return new Observable(emt =>
      this.at((evt, src) => {
        if (!ready) {
          ready = true;
          emt(evt, src);
        }
      })
    );
  }

  first () {
    return new Observable(emt => this.on((evt, src) => this.queue.length === 2 && emt(evt, src)));
  }

  switcher (observables) {
    return new Observable(emt => {
      let current = null;
      const sub = this.on(state => {
        current();
        current = observables[state].on(emt);
      });
      return (...args) => {
        current && current(...args);
        sub && sub(...args);
      };
    });
  }

  reducer (project) {

    //if src stream emits kf - self emts kf
    //if src stream emits first evt after kf - self emts evt
    //if src stream emits n evt - self emit project(acc + evt)
    //if src stream emits cancel evt - self renew the stream
    //if src stream emits confirm evt - self idle

    return new Observable(emt => {
      let acc = empty;
      let history = [];
      return this.on((evt, src) => {
        if (evt === keyF) {
          acc = empty;
          history = [[keyF, src]];
          emt(evt, src);
        } else if (evt === keyA) {
          if (src.is.abort) {
            if (src.rid === -1) throw `requires request "rid" for cancellation`;
            const canceled = history.findIndex(([, { rid }]) => rid === src.rid);
            if (canceled > -1) {
              history.splice(canceled, 1);
              emt(history[0][0], { ...history[0][1], rid: -1 });
              acc = history.slice(1).reduce(([acc], [evt, _src], index, { length }) => {
                acc = [project(acc, evt, _src), _src];
                if (index > length - 3) {
                  emt(acc[0], { ..._src, __sid__: src.__sid__ });
                }
                return acc;
              });
              emt(acc[0], { ...src, rid: -1 });
            }
          }
        } else if (acc === empty) {
          acc = [evt, src];
          history.push(acc);
          emt(...acc);
        } else {
          history.push([evt, src]);
          emt(...acc = [project(acc[0], evt, src), src]);
        }
      });
    });
  }

  reduce (project) {
    return new Observable(emt => {
      let acc = empty;
      return this.on((evt, src) => {
        if (evt === keyF) {
          acc = empty;
          emt(evt, src);
        } else if (acc === empty) {
          acc = evt;
          emt(acc, src);
        } else {
          emt(acc = project(acc, evt, src), src);
        }
      });
    });
  }

  controller (stream, handler = x => x) {
    if (typeof stream === 'function') {
      handler = stream;
      stream = null;
    }
    return new Observable(emt => {
      let value;
      const subs = this.on((...args) => {
        value = args[0];
        emt(...args);
      });
      const over = stream ? stream.on(() => {}) : subs;
      return ({ dissolve, ...args }) => {
        if (dissolve) {
          value = undefined;
          subs({ dissolve: true });
          subs !== over && over({ dissolve: true });
        } else {
          const res = handler({ dissolve: false, ...args }, emt, value);
          res && over(res);
          subs !== over && subs({ dissolve: false, ...args }, emt, value);
        }
      };
    });
  }

  service () {
    return new Observable(emt => {
      const history = [];
      let controller;
      return controller = this.on((evt, src) => {
        src.is = src.is || {};
        if (evt === keyA && src.is.err) {
          history.splice(history.findIndex(([evt, { rid }]) => rid === src.rid), 1);
          controller({ request: history });
        } else if (evt === keyF) {
          history.length = 0;
          history.push([evt, src]);
          emt(evt, src);
        } else {
          history.push([evt, src]);
          emt(evt, src);
        }
      });
    });
  }

  withHandler (handler) {
    return new Observable(emt =>
      this.on((evt, src) => {
        if (keys.includes(evt)) return emt(evt, src);
        const _emt = (evt, _src) => emt(evt, _src || src);
        _emt.emit = _emt;
        return handler(_emt, evt);
      })
    );
  }

  distinct (equal = (a, b) => a === b) {
    return new Observable(emt => {
      let prev = null;
      return this.on((evt, src) => {
        if (evt === keyF) {
          prev = keyF;
        }
        if (!keys.includes(evt)) {
          if (prev === keyF) {
            emt(prev = evt, src);
          } else {
            if (!equal(prev, evt)) {
              emt(prev = evt, src);
            }
          }
        } else {
          emt(evt, src);
        }
      });
    });
  }

  cut (project) {
    return this.withHandler((emt, evt) => {
      const data = project(evt);
      data && emt(data);
    });
  }

  /**
   * @param project
   * @return Observable
   */
  partially (project) {
    return this.withHandler((emt, evt) => emt({ ...evt, ...project(evt) }));
  }

  /**
   * @param project
   * @return Observable
   */
  map (project) {
    return this.withHandler((emt, evt) => emt(project(evt)));
  }

  /**
   *
   * @param project
   * @return Observable
   */
  filter (project) {
    return this.withHandler((emt, evt) => project(evt) && emt(evt));
  }

  log (adapty = (...args) => args) {
    this.on((evt, src) => console.log(...adapty(evt, src)));
    return this;
  }

}

Observable.idx = 0;
Observable.keyF = keyF;
Observable.keyA = keyA;
const keys = Observable.keys = [keyF, keyA];
export const merge = Observable.merge;
export const sync = Observable.sync;
export const combine = Observable.combine;
export const fromPromise = Observable.fromPromise;
export const rid = () => __rid++;
let __rid = 1;