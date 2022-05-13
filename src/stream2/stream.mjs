import now from 'performance-now';
import WSP from './wsp/wsp.mjs';
import RedWSP, { RED_WSP_SUBORDINATION } from './wsp/rwsp.mjs';
import { EMPTY, STATUS_UPDATE } from './signals.mjs';
import {
  FROM_OWNER_STREAM,
  STD_DISCONNECT_REQ,
  EMPTY_FUNCTION,
  STATIC_PROJECTS,
  STATIC_GETTERS,
} from './defs.mjs';
import Controller from './controller.mjs';
import ReduceRemoteTuner from './reduce-remote-tuner.mjs';
import ReplicateRemoteTuner from './replicate-remote-tuner.mjs';
import RedCon5ionHn from './red-connection-handler.mjs';
import { RED_REC_STATUS } from './record/red-record.mjs';
import * as utils from '../utils';
import { arrayShallowEqual } from '../utils';
import RedWSPSlave from './wsp/rwsp-slave.mjs';

const STATIC_LOCAL_RED_WSP = RedWSP.create(
  null, STATIC_PROJECTS.EMPTY_REDUCER, { initialValue: null },
);
const DEFAULT_UPS_VALUE = 50;

let UNIQUE_STREAM_COUNTER = 0;

export class Stream2 {
  constructor(proJ, ctx = null) {
    this.con5ions = new Set();
    this.wsp = null;
    /* <debug> */
    this.$label = '';
    /* </debug> */
    this.project = proJ;
    this.ctx = ctx;
  }

  get id() {
    if (!this.$id) {
      UNIQUE_STREAM_COUNTER += 1;
      this.$id = UNIQUE_STREAM_COUNTER;
    }
    return this.$id;
  }

  static ups(ups = DEFAULT_UPS_VALUE, startAt = now()) {
    return this.fromCbFn((cb, ctr) => {
      // eslint-disable-next-line no-bitwise
      const delay = 1000 / ups | 0;
      let stepCt = 0;
      let ctd;
      function fps() {
        ctd = setTimeout(() => {
          stepCt += 1;
          cb(stepCt);
          fps();
        }, stepCt * delay - now() + startAt);
      }
      fps();
      ctr.todisconnect(() => clearTimeout(ctd));
    });
  }

  static fromNodeEvent(target, event, mapFn) {
    return new Stream2((onrdy, ctr) => {
      const wsp = WSP.create();
      function handler(evtData) {
        wsp.burn(mapFn(evtData));
      }
      ctr.todisconnect(() => target.off(event, handler));
      target.on(event, handler);
      onrdy(wsp);
    });
  }

  static fromEvent(target, evtName) {
    return this.fromCbFn((cb, ctr) => {
      ctr.todisconnect(() => {
        evtName
          .split(' ')
          .forEach((evt) => {
            target.removeAllListener(evt, cb);
          });
      });
      evtName
        .split(' ')
        .forEach((evt) => {
          target.addEventListener(evt, cb);
        });
    });
  }

  static merge(sourcestreams) {
    return new Stream2([], (e, controller) => {
      sourcestreams.map((stream) => stream.connect((hook) => {
        controller.todisconnect(hook);
        return e;
      }));
    });
  }

  static fromWSConnection({ uri }) {
    return new Stream2((onrdy, ctr) => {
      // eslint-disable-next-line no-undef
      const ws = new WebSocket(uri);
      const wsp = WSP.create();
      let remote2localDTsttmp = Number.NEGATIVE_INFINITY;
      const handler = {
        handleEvent(event) {
          if (event.type === 'message') {
            // TODO: hack 2 rms
            const data = JSON.parse(event.data);
            if (data.kind === 'REMOTE_SERVICE_RDY') {
              remote2localDTsttmp = data.sttmp - now();
              return;
            }

            /* <debug> */
            if (remote2localDTsttmp === Number.NEGATIVE_INFINITY) {
              throw new Error('Remote service is not rdy yet.');
            }
            /* </debug> */

            if ('sttmp' in data) {
              data.sttmp -= remote2localDTsttmp;
            }

            wsp.burn(data);
          } else if (event.type === 'open') {
            onrdy(wsp);
          }
        },
        handleCTR(req, data) {
          if (req === STD_DISCONNECT_REQ) {
            ws.close();
            ws.removeEventListener('message', handler);
            ws.removeEventListener('open', handler);
            return;
          }
          ws.send(JSON.stringify(data));
        },
      };
      ctr.link(handler);
      ws.addEventListener('message', handler);
      ws.addEventListener('open', handler);
    });
  }

  factory(
    construct,
    getter = STATIC_GETTERS.STRAIGHT,
    equal = utils.equal,
  ) {
    return new Stream2((onrdy, ctr) => {
      this.connect((wsp, hook) => {
        ctr.to(hook);
        onrdy(wsp.factory(construct, getter, equal));
      });
    });
  }

  // unused now
  gate() {
    return new Stream2((onrdy, ctr) => {
      let connection = null;
      this.connect((wsp, hook) => {
        ctr.todisconnect(hook);
        ctr.tocommand((req, data) => {
          if (connection) {
            hook(req, { ...connection, ...data });
          } else if (req.kind === 'SUBSCRIBE') {
            // subscribers queue
          }
        });
        wsp.on({
          handleR(rec) {
            if (rec.value.kind === 'CONNECTION') {
              connection = { clientID: rec.value.clientID };
            }
          },
        });
        onrdy(ctr);
      });
    });
  }

  way({ path, args = null }) {
    /* <debug> */
    if (utils.isUndef(path)) {
      throw new TypeError('Required "path" param');
    }
    /* </debug> */
    return new Stream2((onrdy, ctr) => {
      this.connect((wsp, hook) => {
        ctr.todisconnect(hook);
        ctr.req('coordinate', ({ value: data, id }) => {
          hook('*', {
            kind: 'COORDINATE',
            path,
            args,
            event: { id },
            data,
          });
        });
        onrdy(wsp.map(({ value }) => {
          if (value.path !== path) {
            return EMPTY;
          }
          if (value.kind === 'INIT') {
            return value.data;
          }
          if (value.kind === 'STATUS_UPDATE') {
            return {
              sttmp: value.sttmp,
              id: value.event.id,
              kind: STATUS_UPDATE,
              status: RED_REC_STATUS[value.status.toUpperCase()],
            };
          }
          if (value.kind[0] === '$') {
            return EMPTY;
          }
          throw new TypeError('Unsupported signal type');
        }));
        hook('*', {
          kind: 'SUBSCRIBE',
          path,
          args,
        });
      });
    });
  }

  /**
   * TODO:
   *  wsp (primary) -> burn(value, token)
   *  wsp (secondary) -> handleR(cuR)
   *  wsp hnProJ? need wsp burn-point
   */
  static handle(hnProJ = null) {
    return new Stream2((onrdy, control) => {
      const wsp = WSP.create(null, null);
      if (hnProJ) {
        const hn = hnProJ();
        control.tocommand(
          ...Object.keys(hn)
            .map((key) => (request, data) => {
              if (request === key) {
                wsp.burn(hn[key](request, data));
              }
            }),
        );
      } else {
        control.tocommand((req, data) => ({ req, data }));
      }
      onrdy(wsp);
    });
  }

  requester(proJ) {
    return new Stream2((onrdy, control) => {
      this.connect((wsp, hook) => {
        control.to(hook);
        proJ((request, data) => {
          /* <debug> */
          if (request === STD_DISCONNECT_REQ) {
            throw new TypeError('Static request cannot disconnect streams');
          }
          /* </debug> */
          control.send(request, data);
        });
        onrdy(wsp);
      });
    });
  }

  controller(stream) {
    return new Stream2((onrdy, ctr) => {
      this.connect((wsp, hook) => {
        ctr.todisconnect(hook);
        stream.connect((_hook) => {
          ctr.to(_hook);
          onrdy(wsp);
        });
      });
    });
  }

  /* <debug> */
  label(label) {
    this.$label = label;
    return this;
  }
  /* </debug> */

  configure({ slave = false, stmp = false } = {}) {
    return new Stream2(null, (e, controller) => {
      this.connect((hook) => {
        controller.to(hook);
        return (data, record) => {
          e(data, { ...record, slave, stmp: -stmp });
        };
      });
    });
  }

  /**
   * @param {Promise} source - Input source
   * @param {Function} proJ - Mapper project function
   * @returns {Stream2}
   */
  static from(source, proJ) {
    if (source instanceof Promise) {
      return this.fromPromise(source, proJ);
    }
    throw new TypeError('Unsupported source type');
  }

  static fromCbFunc(...args) {
    // eslint-disable-next-line no-console
    console.warn('deprecated now');
    return this.fromCbFn(...args);
  }

  static fromCbFn(cb = () => {}, conf) {
    return new Stream2((onrdy, ctr) => {
      onrdy(RedWSP.fromCbFunc((e) => cb(e, ctr), conf));
    });
  }

  static fromFn(cb) {
    return new Stream2((onrdy) => {
      onrdy(RedWSP.create(
        null,
        STATIC_PROJECTS.EMPTY_REDUCER,
        { initialValue: cb() },
      ));
    });
  }

  static emptyChannel() {
    return this.fromCbFn();
  }

  static get EMPTY() {
    if (!this.$EMPTY) {
      this.$EMPTY = this.fromFn(() => null);
    }
    return this.$EMPTY;
  }

  static get EMPTY_ARR() {
    if (!this.$EMPTY_ARR) {
      this.$EMPTY_ARR = this.fromFn(() => []);
    }
    return this.$EMPTY_ARR;
  }

  /**
   *
   * @param proJ
   * @param {{local}|{remote}} initialValue
   * @param {*} dbg Debug config
   * @returns {Stream2}
   */
  reduce(proJ, initialValue, dbg) {
    const hnProJ = (owner) => ([{ value: next }]) => proJ(
      owner.getLastStateValue(), next,
    );
    if ('local' in initialValue) {
      return this.reduceLocal(hnProJ, initialValue.local, dbg);
    }
    if ('remote' in initialValue) {
      return this.reduceRemote(hnProJ, initialValue.remote, dbg);
    }
    throw new TypeError('Unsupported initial value type');
  }

  reduceLocal(hnProJ, initialValue /* { rejectable = false } = {} */) {
    return new Stream2((onrdy, ctr) => {
      this.connect((wsp, hook) => {
        ctr.to(hook);
        const rwsp = RedWSP.create([wsp], hnProJ, { initialValue });
        // TODO: need to use RED-remote-tuner instead
        /* if (rejectable) {
          rwsp.on(LocalRedWSPRecStatusCTR);
        } */
        onrdy(rwsp);
      });
    });
  }

  /**
   * Запись создается
   * ей передается ссылка на канал согласования
   * Если запись становится неактуальной, то она должна получить известие об этом
   * тогда она сможет отключиться от канала согласования
   */
  reduceRemote(hnProJ, initialValue, dbg) {
    return new Stream2((onrdy, ctr) => {
      new ReduceRemoteTuner(Stream2, onrdy, ctr, hnProJ, dbg)
        .setup(initialValue, this);
    });
  }

  replicate(proJ, initialValue) {
    const hnProJ = (owner) => ([{ value: next }]) => proJ(
      owner.getLastStateValue(), next,
    );
    if ('remote' in initialValue) {
      return this.replicateRemote(hnProJ, initialValue.remote);
    }
    throw new TypeError('Unsupported initial value type');
  }

  // работает как редьюсер, но расчитывает на то, что
  // удаленный сервис имеет логику генерации событий,
  // которая в точности воспроизводится на клиенте
  // без необходимости синхронизации каждого шага
  replicateRemote(hnProJ, initialValue) {
    return new Stream2((onrdy, ctr) => {
      new ReplicateRemoteTuner(Stream2, onrdy, ctr, hnProJ)
        .setup(initialValue, this);
    });
  }

  /**
   * Attaches additional streams to the master but never uses them
   * @param {Array.<Stream2>} streams
   * @returns {Stream2}
   */
  abuse(streams) {
    if (!streams.length) {
      return this;
    }
    return new Stream2((onrdy, ctr) => {
      this.whenAllRedConnected([this, ...streams], (con5ion) => {
        ctr.tocommand(con5ion.streams[0].hook);
        ctr.todisconnect(...con5ion.streams.map(({ hook }) => hook));
        onrdy(con5ion.streams[0].wsp);
      });
    });
  }

  /**
   * Create connection to additional streams but never uses them
   * @param {Array.<Stream2>} streams
   * @returns {Stream2}
   */
  static abuse(streams) {
    if (!streams.length) {
      return Stream2.EMPTY;
    }
    return new Stream2((onrdy, ctr) => {
      this.whenAllRedConnected(streams, (con5ion) => {
        ctr.todisconnect(...con5ion.map(({ hook }) => hook));
        onrdy(STATIC_LOCAL_RED_WSP);
      });
    });
  }

  /**
   * @param {Stream2[]|{}} streams
   * @param proJ
   * @param ctrMode
   * @param conf
   * @returns {Stream2}
   */
  static combine(
    streams,
    proJ = STATIC_PROJECTS.STRAIGHT,
    { ctrMode = 'none', ...conf } = { },
  ) {
    /* <debug> */
    if (streams === undefined) {
      throw new TypeError();
    }
    if (!streams.length) {
      if (proJ === STATIC_PROJECTS.STRAIGHT) {
        return Stream2.$EMPTY_ARR;
      }
      return this.fromFn(() => proJ([]));
    }
    /* </debug> */
    return new Stream2((onrdy, ctr) => {
      ctr.co5s(streams, (wsps) => {
        let init = false; /// TODO: ???
        RedWSPSlave.merge(
          wsps,
          (own) => {
            const combined = new Map(own.wsps.map((wsp) => [wsp, EMPTY]) || []);
            // To keep the order of output
            // Исчтоники могут повторяться
            let awaitingFilling = combined.size;
            return (updates) => {
              for (let i = 0; i < updates.length; i += 1) {
                const { src, value } = updates[i];
                if (awaitingFilling) {
                  if (combined.get(src) === EMPTY) {
                    awaitingFilling -= 1;
                  }
                }
                combined.set(src, value);
              }
              if (!awaitingFilling) {
                return proJ(own.wsps.map((wsp) => combined.get(wsp)), updates);
              }
              return EMPTY;
            };
          },
          {
            after5fullUpdateHn(wsp) {
              if (!init) {
                init = true;
                onrdy(wsp);
              }
            },
          },
          conf,
        );
      }, { ctrMode });
    });
  }

  withlatest(
    streams,
    proJ = STATIC_PROJECTS.STRAIGHT,
    { ctrMode = 'none', ...conf } = { },
  ) {
    return this.constructor.withlatest(
      [this, ...streams],
      proJ,
      { ctrMode, ...conf },
    );
  }

  static withlatest(
    streams,
    proJ = STATIC_PROJECTS.STRAIGHT,
    { ctrMode = 'none', ...conf } = { },
  ) {
    if (!streams.length) {
      if (proJ === STATIC_PROJECTS.STRAIGHT) {
        return Stream2.$EMPTY_ARR;
      }
      return this.fromFn(() => proJ([]));
    }
    return new Stream2((onrdy, ctr) => {
      this.whenAllRedConnected(streams, (con5tion) => {
        if (ctrMode === 'all') {
          ctr.to(...con5tion.streams.map(({ hook }) => hook));
        } else if (ctrMode === 'none') {
          ctr.todisconnect(...con5tion.streams.map(({ hook }) => hook));
        } else {
          throw new Error('Unsupported controller mode');
        }
        const wsps = con5tion.streams.map(({ wsp }) => wsp);
        // Несмотря на то, что базовые хранилища уже готовы
        // на момент запуска дочернего, он все равно имеет шанс
        // инициализироваться позднее, так как будет
        // завершать процесс синхронизации
        RedWSPSlave.extendedWithlatest(wsps, () => proJ, null, {
          onReT4completeCb: onrdy, ...conf,
        });
      });
    });
  }

  static $instance(wsp) {
    return wsp instanceof RedWSP ? RedWSPSlave : WSP;
  }

  /**
   * Комбинирует все данные из списка потоков потока верхнего уровня
   * Если список пустой то создается специальное событие пустого списка
   */
  combineAll(proJ = STATIC_PROJECTS.STRAIGHT, conf) {
    return new Stream2((onrdy, ctr) => {
      ctr.co5s([this], ([headWsp], localCTR) => {
        let init = false; /// TODO: ???
        RedWSPSlave.merge(
          [headWsp],
          (own) => {
            const wsps = own.wsps.slice(1);
            const combined = new Map(wsps.slice(1).map((wsp) => [wsp, EMPTY]) || []);
            // To keep the order of output
            // Исчтоники могут повторяться
            let awaitingFilling = combined.size;
            return (updates) => {
              for (let i = 0; i < updates.length; i += 1) {
                const { src, value } = updates[i];
                if (src === headWsp) {
                  // TODO: hack Пытаюсь здесь обновлять список только по последнему значению
                  if (!headWsp.getLastStateValue().length) {
                    return proJ([], updates);
                  }
                } else {
                  if (awaitingFilling) {
                    if (combined.get(src) === EMPTY) {
                      awaitingFilling -= 1;
                    }
                  }
                  combined.set(src, value);
                }
              }
              if (!awaitingFilling && updates.some(({ src }) => src !== headWsp)) {
                return proJ(wsps.map((wsp) => combined.get(wsp)), updates);
              }
              return EMPTY;
            };
          },
          {
            after5UpdateHn: (own) => {
              const newStreams = [this, ...own.wsps[0].getLastStateValue()];
              if (!arrayShallowEqual(localCTR.streams, newStreams)) {
                const locked = own.getLockedState();
                localCTR.renew(newStreams, (newWSPS) => {
                  own.reConfigurate(newWSPS, locked);
                });
                return true;
              }
              return false;
            },
            after5fullUpdateHn: (own) => {
              if (!init) {
                init = true;
                onrdy(own);
              }
            },
          },
          conf,
        );
      });
    });
  }

  static eCombine(streams, proJ, setup = null, controller, conf = {}) {
    return new Stream2((onrdy, ctr) => {
      ctr.co5s(streams, (wsps, localCTR) => {
        let init = false; /// TODO: ???
        RedWSPSlave.merge(
          wsps,
          (own) => {
            const combined = new Map(own.wsps.slice(1).map((wsp) => [wsp, EMPTY]) || []);
            // To keep the order of output
            // Исчтоники могут повторяться
            let awaitingFilling = combined.size;
            return (updates) => {
              for (let i = 0; i < updates.length; i += 1) {
                const { src, value } = updates[i];
                if (awaitingFilling) {
                  if (combined.get(src) === EMPTY) {
                    awaitingFilling -= 1;
                  }
                }
                combined.set(src, value);
              }
              if (!awaitingFilling) {
                return proJ(own.wsps.map((wsp) => combined.get(wsp)), updates);
              }
              return EMPTY;
            };
          },
          {
            after5UpdateHn(own) {
              if (setup) {
                const newStreams = setup(own.getLastStateValue());
                if (!arrayShallowEqual(localCTR.streams, newStreams)) {
                  const locked = own.getLockedState();
                  localCTR.renew(newStreams, (newWSPS) => {
                    own.reConfigurate(newWSPS, locked);
                  });
                  return true;
                }
              }
              return false;
            },
            after5fullUpdateHn(own) {
              if (!init) {
                init = true;
                onrdy(own);
              }
              if (controller) {
                controller(own.getLastStateValue(), localCTR.connections);
              }
            },
          },
          conf,
        );
      });
    });
  }

  combineAllFirst(conf) {
    // TODO: not completed solution
    return new Stream2((onrdy, ctr) => {
      this.connect((headWsp, headHook) => {
        ctr.todisconnect(headHook);
        ctr.todisconnect(() => headWsp.kill());
        Stream2.$instance(headWsp).create([headWsp], () => ([{ value }]) => {
          Stream2.whenAllRedConnected(value, (con5tion) => {
            ctr.to(...con5tion.streams.map(({ hook }) => hook));
            onrdy(RedWSPSlave.extendedCombine(
              con5tion.streams.map(({ wsp }) => wsp),
              () => (combiner) => combiner,
              null,
              {
                arrayOrObjectMode: true,
                ...conf,
              },
            ));
          });
        }, conf);
      });
    });
  }

  gripFirst(getter = STATIC_GETTERS.STRAIGHT) {
    return new Stream2((onrdy, ctr) => {
      this.connect((headWSP, headHook) => {
        ctr.todisconnect(headHook);
        let init = false;
        headWSP.get(({ value }) => {
          if (value !== EMPTY) {
            if (!init) {
              init = true;
              getter(value).connect((wsp, hook) => {
                ctr.to(hook);
                onrdy(wsp);
              });
            }
          }
        });
      });
    });
  }

  store(conf = {}) {
    return new Stream2((onrdy, ctr) => {
      this.connect((wsp, hook) => {
        ctr.to(hook);
        if (wsp instanceof RedWSP) {
          onrdy(wsp);
          return;
        }
        let rwsp = null;
        const hn = {
          handleR(cuR) {
            if (cuR.value === EMPTY) return;
            if (!rwsp) {
              rwsp = RedWSP.create(
                [wsp], () => ([{ value }]) => value, conf,
              );
              onrdy(rwsp);
              wsp.off(hn);
            }
          },
        };
        wsp.on(hn);
      });
    });
  }

  static whenAllRedConnected(streams, cb) {
    new RedCon5ionHn(cb).reconnect(streams);
  }

  static whenAllConnected(streams, cb) {
    const states = new Array(streams.length);
    let rdyCounter = 0;
    const connections = streams.map((stream, idx) => stream.connect((wsp, hook) => {
      states[idx] = [wsp, hook];
      rdyCounter += 1;
      if (rdyCounter === streams.length) {
        cb(states);
      }
    }));
    return (req, data) => connections.forEach((cnct) => cnct(req, data));
  }

  static fromPromise(source, proJ = STATIC_PROJECTS.STRAIGHT) {
    return new Stream2((onrdy, ctr) => {
      source.then((value) => {
        if (!ctr.disconnected) {
          onrdy(RedWSP.create(
            null,
            STATIC_PROJECTS.EMPTY_REDUCER,
            { initialValue: proJ(value) },
          ));
        }
      });
    });
  }

  static with(streams, hnProJ, { subordination = null } = {}, args = {}) {
    // eslint-disable-next-line no-param-reassign
    /* <debug> */ args = { operator: { name: 'with' }, ...args }; /* </debug> */
    /* <debug> */
    if (streams.length !== 1 && subordination === RED_WSP_SUBORDINATION.MASTER) {
      throw new TypeError(
        'Unsupported configuration type. Master WSP can have no more than one source',
      );
    }
    /* </debug> */
    const calculableConfig = {
      subordination,
    };
    /* if (!localization) {
      if (streams.some((wsp) => wsp.localization === RED_REC_LOCALIZATION.LOCAL)) {
      } else {
        calculableConfig.localization = RED_REC_LOCALIZATION.REMOTE;
      }
    } */
    if (subordination === null) {
      calculableConfig.subordination = RED_WSP_SUBORDINATION.SLAVE;
    }
    return new Stream2((onrdy/* , ctr */) => {
      let notConnectedCounter = streams.length;
      const wsps = [];
      streams.forEach((stream) => {
        stream.connect((wsp/* , hook */) => {
          wsps.push(wsp);
          notConnectedCounter -= 1;
          if (!notConnectedCounter) {
            // TODO: instead of every RedWSP someone use CoWSP
            if (wsps.every((_wsp) => _wsp instanceof RedWSP)) {
              onrdy(RedWSPSlave.create(wsps, hnProJ, args));
            } else {
              onrdy(WSP.create(wsps, hnProJ, args));
            }
          }
        });
      });
    });
  }

  // канал является переходит в состояние включен
  // когда получает ссылку на эмитер при вызове connect

  /**
   * !!! Отдает все состояния, в том числе и ReT4
   * @param {Function} getter
   * @param {*} conf
   */
  get(getter = EMPTY_FUNCTION, conf = {}) {
    return new Stream2((onrdy, control) => {
      this.connect((wsp, hook) => {
        control.to(hook);
        let Species = WSP;
        if (wsp instanceof RedWSP) {
          Species = RedWSPSlave;
        }
        onrdy(Species.create([wsp], () => (updRecS) => {
          getter(updRecS[0]);
          return updRecS;
        }, conf));
      });
    }).connect();
  }

  side(proJ) {
    return new Stream2((onrdy, control) => {
      this.connect((wsp, hook) => {
        control.to(hook);
        let Species = WSP;
        if (wsp instanceof RedWSP) {
          Species = RedWSPSlave;
        }
        onrdy(new Species([wsp], (owner) => {
          const transform = proJ(owner);
          return (updates) => {
            transform(updates);
            return updates;
          };
        }));
      });
    });
  }

  map(proJ, conf = {}) {
    return this.mapF(({ value }) => proJ(value), conf);
  }

  /**
   * Gen Map like list of streams from single stream of Mapped list records
   *  cache here must be a separate stream mb? + has default value
   */
  kit(_, conf) {
    return new Stream2((onrdy, ctr) => {
      this.connect((wsp, hook) => {
        const cache = new Map();
        ctr.to(hook);
        onrdy(wsp.map(({ value: list }) => {
          /* <debug> */
          if (!(list instanceof Map)) {
            throw new TypeError('Only Map like list of records is supported');
          }
          /* </debug> */
          const res = new Map();
          // eslint-disable-next-line no-restricted-syntax
          for (const key of list.keys()) {
            let exist = cache.get(key);
            if (!exist) {
              exist = this.accumulate((acc, value) => {
                const item = value.get(key);
                if (acc === EMPTY) {
                  return item;
                }
                if (item === acc) {
                  return EMPTY;
                }
                return item;
              }, conf);
              cache.set(key, exist);
            }
            res.set(key, exist);
          }
          return res;
        }));
      });
    });
  }

  accumulate(proJ, conf) {
    return new Stream2((onrdy, ctr) => {
      this.connect((wsp, hook) => {
        ctr.to(hook);
        onrdy(RedWSPSlave.create(
          [wsp],
          (own) => ([{ value }]) => proJ(own.getLastStateValue(), value),
          conf,
        ));
      });
    });
  }

  mapF(proJ, conf = {}) {
    return new Stream2((onrdy, ctr) => {
      this.connect((wsp, hook) => {
        ctr.to(hook);
        onrdy(wsp.map(proJ, conf));
      });
    });
  }

  filter(proJ, conf) {
    return this.filterF(({ value }) => proJ(value), conf);
  }

  filterF(proJ, conf) {
    return new Stream2((onrdy, ctr) => {
      this.connect((wsp, hook) => {
        ctr.to(hook);
        onrdy(wsp.filter(proJ, conf));
      });
    });
  }

  log(proJ = (vl) => vl, conf = {}) {
    return this.mapF(({ value }) => {
      // eslint-disable-next-line no-console
      console.log(proJ(value));
      return value;
    }, conf);
  }

  debug(conf = {}) {
    return this.mapF(({ value }) => {
      // eslint-disable-next-line no-debugger
      debugger;
      return value;
    }, conf);
  }

  connect(con5ion = () => {}) {
    this.con5ions.add(con5ion);
    if (!this.connection) {
      const ctr = this.createCTR();
      this.connection = {
        ctr,
        wsp: null,
      };
      this.hook = (req = STD_DISCONNECT_REQ, data = null) => {
        /* <debug> */
        if (typeof req !== 'string') {
          throw new TypeError('Action must be a string only');
        }
        /* </debug> */
        if (req === STD_DISCONNECT_REQ) {
          this.$deactivate(con5ion, ctr);
        } else {
          ctr.send(req, data);
        }
      };
      this.$activate(ctr);
    } else if (this.wsp) {
      this.usecon5ion(con5ion);
    }
    return (req, data) => this.hook(req, data);
  }

  usecon5ion(con5ion) {
    if (typeof con5ion === 'function') {
      con5ion(this.wsp, this.hook);
    } else {
      con5ion.hn(this);
    }
  }

  distinct(equal = STATIC_PROJECTS.SURFACE_EQUAL) {
    return new Stream2((onrdy, ctr) => {
      this.connect((wsp, hook) => {
        if (!(wsp instanceof RedWSP)) {
          throw new Error('Unsupported mode');
        }
        ctr.to(hook);
        onrdy(wsp.distinct(equal));
      });
    });
  }

  $activate(ctr) {
    this.project.call(
      this.ctx,
      (wsp) => {
        /* <debug> */
        if ((wsp instanceof RedWSP) && wsp.getLastStateValue() === EMPTY) {
          throw new Error('Unsupported internal WSP state. Stream not opened yet.');
        }
        /* </debug> */
        return this.startConnectionToSlave(wsp);
      },
      ctr,
    );
  }

  // when projectable stream connecting rdy
  startConnectionToSlave(wsp) {
    this.wsp = wsp;
    [...this.con5ions]
      .forEach(this.usecon5ion, this);
  }

  $deactivate(connect, ctr) {
    this.con5ions.delete(connect);
    if (!this.con5ions.size) {
      ctr.send(STD_DISCONNECT_REQ, null);
    }
  }

  createCTR() {
    return new Controller(this);
  }
}

export const stream2 = (...args) => new Stream2(...args);
// static props recalc to stream2
Object.getOwnPropertyNames(Stream2)
  .filter((prop) => typeof Stream2[prop] === 'function')
  .forEach((prop) => {
    stream2[prop] = Stream2[prop];
  });

Stream2.FROM_OWNER_STREAM = FROM_OWNER_STREAM;
