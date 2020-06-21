import getTTMP from './get-ttmp';
import WSP from './wsp';
import Record from './record/record';
import { RED_REC_SUBORDINATION } from './record/red-record';
import LocalRedWSPRecStatusCTR from './local-rwsp-rec-status-ctr';
import RedWSPSlave from './rwsp-slave';
import RedWSP from './rwsp';
import { EMPTY } from './signals';
import { STD_DISCONNECT_REQ } from './defs';
import Controller from './controller';
import WSPSchemaTuner from './wsp-chema-tuner';

const EMPTY_OBJECT = Object.freeze({ empty: 'empty' });
const EMPTY_FN = () => EMPTY_OBJECT;
const FROM_OWNER_STREAM = Object.freeze({ fromOwnerStream: 'fromOwnerStream' });
let GLOBAL_CONNECTIONS_ID_COUNTER = 1;
const STATIC_PROJECTS = {
  STRAIGHT: (data) => data,
  AIO: (...args) => args,
};

const TYPES = { PIPE: 0, STORE: 1 };

export class Stream2 {
  constructor(proJ, ctx = null) {
    this.con5ions = new Map();
    this.wsp = null;
    /* <debug> */
    this.$label = '';
    /* </debug> */
    this.project = proJ;
    this.ctx = ctx;
    this.type = new.target.TYPES.PIPE;
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

  static merge(sourcestreams) {
    return new Stream2([], (e, controller) => {
      sourcestreams.map((stream) => stream.connect((hook) => {
        controller.todisconnect(hook);
        return e;
      }));
    });
  }

  /**
   * TODO:
   *  wsp (primary) -> burn(value, token)
   *  wsp (secondary) -> handleR(stream, cuR)
   *  wsp hnProJ? need wsp burn-point
   */
  static handle(hnProJ) {
    return new Stream2((onrdy, control) => {
      const req = hnProJ();
      const wsp = WSP.create(null, null);
      control.tocommand(
        ...Object.keys(req)
          .map((key) => (request, data) => {
            if (request === key) {
              wsp.burn(req[key](request, data));
            }
          }),
      );
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

  controller(connection) {
    return new Stream2(null, (e, controller) => {
      this.connect((hook) => {
        connection.connect((_hook) => {
          controller.to(_hook);
          return EMPTY_FN;
        });
        controller.to(hook);
        return e;
      });
    });
  }

  reduceF(state, project, init) {
    if (state instanceof Function) {
      init = project;
      project = state;
      state = FROM_OWNER_STREAM;
    }
    return new Reducer(this, project, state, init);
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

  static fromCbFunc(cb) {
    return new Stream2((onrdy, ctr) => {
      onrdy(WSP.fromCbFunc((e) => cb(e, ctr)));
    });
  }

  static fromFn(cb) {
    return new Stream2((onrdy) => {
      onrdy(WSP.fromFn(cb));
    });
  }

  /**
   *
   * @param proJ
   * @param {{local}|{remote}} initialValue
   * @returns {Stream2}
   */
  reduce(proJ, initialValue) {
    const hnProJ = (owner) => ([{ value: next }]) => proJ(
      owner.state.slice(-1)[0].value, next,
    );
    if ('local' in initialValue) {
      return this.reduceLocal(hnProJ, initialValue.local);
    }
    if ('remote' in initialValue) {
      return this.reduceRemote(hnProJ, initialValue.remote);
    }
    throw new TypeError('Unsupported initial value type');
  }

  reduceLocal(hnProJ, initialValue) {
    return new Stream2((onrdy, control) => {
      this.connect((wsp, hook) => {
        control.to(hook);
        const rwsp = RedWSP.create([wsp], hnProJ, { initialValue });
        rwsp.on(LocalRedWSPRecStatusCTR);
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
  reduceRemote(hnProJ, initialValue) {
    return new Stream2((onrdy, ctr) => {
      Stream2.whenAllConnected([initialValue, this], ([[wspR, hookR], [wsp, hook]]) => {
        ctr.to(hook);
        let rwsp = null;
        wspR.on({
          handleR(src, rec) {
            if (rec.value !== EMPTY) {
              if (!rwsp) {
                rwsp = RedWSP.create([wsp], hnProJ, { initialValue: rec.value });
                onrdy(rwsp);
                rwsp.on({
                  handleR(_rec) {
                    hookR('remote-confirm', _rec);
                  },
                });
              } else {
                rwsp.open(rec.value);
              }
            }
          },
        });
      });
    });
  }

  static combine(streams, proJ = (upds) => upds, conf = {}) {
    if (!streams.length) {
      return this.fromCbFunc((cb) => cb(proJ([])));
    }
    if (streams.length === 1) {
      return streams[0].map((vl) => proJ([vl]));
    }
    return new Stream2((onrdy, ctr) => {
      this.whenAllRedConnected(streams, (bags) => {
        ctr.todisconnect(...bags.map(([, hook]) => hook));
        const wsps = bags.map(([wsp]) => wsp);
        if (wsps.every((_wsp) => _wsp instanceof RedWSP)) {
          onrdy(RedWSPSlave.combine(wsps, proJ, conf));
        } else {
          onrdy(WSP.combine(wsps, proJ, conf));
        }
      });
    });
  }

  static extendedCombine(streams, proJ, { tuner = null } = {}) {
    return new Stream2((onrdy, ctr) => {
      new WSPSchemaTuner(this, onrdy, ctr, proJ, tuner)
        .add(streams);
    });
  }

  static $instance(wsp) {
    return wsp instanceof RedWSP ? RedWSPSlave : WSP;
  }

  combineAllFirst(get = null, set = null, conf = {}) {
    // TODO: not completed solution
    return new Stream2((onrdy, ctr) => {
      this.connect((headWsp, headHook) => {
        ctr.todisconnect(headHook);
        ctr.todisconnect(() => headWsp.kill());
        Stream2.$instance(headWsp).create([headWsp], () => ([{ value }]) => {
          Stream2.whenAllRedConnected(get ? get(value) : value, (bags) => {
            ctr.to(...bags.map(([, hook]) => hook));
            onrdy(RedWSPSlave.combine(
              bags.map(([wsp]) => wsp),
              (combiner) => (set ? set(value, combiner) : combiner),
              conf,
            ));
          });
        }, conf);
      });
    });
  }

  store() {
    return new Stream2((onrdy, ctr) => {
      this.connect((wsp, hook) => {
        ctr.to(hook);
        let init = false;
        wsp.on({
          handleR(src, cuR) {
            if (!init) {
              init = true;
              const rwsp = RedWSP.create(
                [wsp.cut(1)], () => ([{ value }]) => value, { initialValue: cuR.value },
              );
              rwsp.on(LocalRedWSPRecStatusCTR);
              onrdy(rwsp);
            }
          },
        });
      });
    });
  }

  static whenAllRedConnected(streams, cb) {
    const states = new Array(streams.length);
    let rdyCounter = 0;
    function handler(wsp, hook, idx) {
      states[idx] = [wsp, hook];
      rdyCounter += 1;
      if (rdyCounter === streams.length) {
        cb(states);
      }
    }
    streams.map((stream, idx) => stream.connect((wsp, hook) => {
      if (wsp instanceof RedWSP) {
        handler(wsp, hook, idx);
      } else {
        stream.store().connect((_wsp, _hook) => {
          handler(_wsp, _hook, idx);
        });
        hook();
      }
    }));
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

  static fromPromise(source, project = STATIC_PROJECTS.STRAIGHT) {
    return new Stream2(null, (e, controller) => {
      source.then((data) => {
        if (!controller.disconnected) {
          e(project(data));
        }
      });
    });
  }

  static with(streams, hnProJ, { localization = null, subordination = null } = {}, args = {}) {
    // eslint-disable-next-line no-param-reassign
    /* <debug> */ args = { operator: { name: 'with' }, ...args }; /* </debug> */
    /* <debug> */
    if (streams.length !== 1 && subordination === RED_REC_SUBORDINATION.MASTER) {
      throw new TypeError(
        'Unsupported configuration type. Master WSP can have no more than one source',
      );
    }
    /* </debug> */
    const calculableConfig = {
      localization,
      subordination,
    };
    /* if (!localization) {
      if (streams.some((wsp) => wsp.localization === RED_REC_LOCALIZATION.LOCAL)) {
        calculableConfig.localization = RED_REC_LOCALIZATION.LOCAL;
      } else {
        calculableConfig.localization = RED_REC_LOCALIZATION.REMOTE;
      }
    } */
    if (subordination === null) {
      calculableConfig.subordination = RED_REC_SUBORDINATION.SLAVE;
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
   */
  get(getter = EMPTY_FN) {
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
        }));
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
        }, { reT4able: true }));
      });
    });
  }

  map(proJ) {
    return this.mapF(({ value }) => proJ(value));
  }

  mapF(proJ) {
    return new Stream2((onrdy, ctr) => {
      this.connect((wsp, hook) => {
        ctr.to(hook);
        onrdy(wsp.map(proJ));
      });
    });
  }

  filter(proJ) {
    return this.filterF(({ value }) => proJ(value));
  }

  filterF(proJ) {
    return new Stream2((onrdy, ctr) => {
      this.connect((wsp, hook) => {
        ctr.to(hook);
        onrdy(wsp.filter(proJ));
      });
    });
  }

  /* <debug> */
  log(proJ = (vl) => vl) {
    return this.mapF(({ value }) => (console.log(proJ(value)), value));
  }
  /* </debug> */

  connect(con5ion = () => () => {}) {
    this.con5ions.set(con5ion, null);
    if (!this.connection) {
      const ctr = this.createController();
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
      con5ion(this.wsp, this.hook);
    }
    return (req, data) => this.hook(req, data);
  }

  distinct(equal) {
    return new Stream2(null, (e, controller) => {
      let state = EMPTY_OBJECT;
      this.connect((hook) => {
        controller.to(hook);
        return (data, record) => {
          if (isKeySignal(data)) {
            if (data === keyA) {
              state = EMPTY_OBJECT;
            }
            return e(data, record);
          }
          if (state === EMPTY_OBJECT) {
            state = data;
            e(data, record);
          } else if (!equal(state, data)) {
            state = data;
            e(data, record);
          }
        };
      });
    });
  }

  $activate(ctr) {
    this.project.call(
      this.ctx,
      (wsp) => this.startConnectionToSlave(wsp),
      ctr,
    );
  }

  // when projectable stream connecting rdy
  startConnectionToSlave(wsp) {
    this.wsp = wsp;
    [...this.con5ions.keys()]
      .forEach((con5ion) => con5ion(this.wsp, this.hook));
  }

  $deactivate(connect, controller) {
    this.con5ions.delete(connect);
    if (!this.con5ions.size) {
      controller.send(STD_DISCONNECT_REQ, null);
    }
  }

  createEmitter(subscriber, evtChWSpS) {
    /* <debug> */
    return (rec) => {
      if (!Array.isArray(evtChWSpS)) {
        throw new TypeError('Zero spring chanel produced some data?');
      }
      if (evtChWSpS.some((wsp) => !(wsp instanceof WSP))) {
        throw new TypeError('WSP event sources only supported');
      }
      if (!(rec instanceof Record)) {
        throw new TypeError('WellSpring record expected');
      }
      if (![...this.connections.values()].includes(subscriber)) {
        throw 'More unused stream continues to emit data';
      }
      subscriber(rec);
    };
    /* </debug> */
    // eslint-disable-next-line no-unreachable
    return subscriber;
  }

  createController() {
    return new Controller(this);
  }

  static sync(sourcestreams, equal, poject = STATIC_PROJECTS.AIO) {
    return this
      .combine(sourcestreams)
      .withHandler((e, streams) => {
        if (streams.length > 1) {
          if (streams.every((stream) => equal(streams[0], stream))) {
            e(poject(...streams));
          }
        } else if (streams.length > 0) {
          if (equal(streams[0], streams[0])) {
            e(poject(...streams));
          }
        } else {
          e(poject());
        }
      });
  }

  withHandler(handler) {
    return new Stream2(null, (e, controller) => this.connect((hook) => {
      controller.to(hook);
      return (evt, record) => {
        if (Observable.keys.includes(evt)) {
          return e(evt, record);
        }
        const _e = (evt, _record) => e(evt, _record || record);
        return handler(_e, evt);
      };
    }));
  }

  withlatest(sourcestreams = [], project = STATIC_PROJECTS.AIO) {
    return new Stream2(null, (e, controller) => {
      let slave = false;
      const sourcestreamsstate = new Array(sourcestreams.length).fill(EMPTY_OBJECT);
      sourcestreams.map((stream, i) => {
        stream.connect((hook) => {
          controller.todisconnect(hook);
          return (data, record) => {
            if (record.slave) slave = true;
            if (isKeySignal(data)) {
              return e(data, { ...record, slave });
            }
            sourcestreamsstate[i] = data;
          };
        });
      });
      this.connect((hook) => {
        controller.to(hook);
        return (data, record) => {
          if (isKeySignal(data)) {
            return e(data, record);
          }
          if (!sourcestreamsstate.includes(EMPTY_OBJECT)) {
            e(project(data, ...sourcestreamsstate), { ...record, slave });
          }
        };
      });
    });
  }

  /**
   * @param {fromRemoteService} remoteservicecontroller - Remoute service controller connection
   * @param {Object} stream - Stream name from server
   */
  static fromRemoteService(remoteservicecontroller, stream) {
    return new Stream2(null, (e, controller) => {
      const connection = { id: GLOBAL_CONNECTIONS_ID_COUNTER += 1 };
      remoteservicecontroller.connect((hook) => {
        controller.tocommand((request, data) => {
          if (request === 'request') {
            hook('command', { data, connection });
          }
        });
        controller.todisconnect(hook);
        return ({ event, data, connection: { id } }, record) => {
          if (event === 'remote-service-ready') {
            hook('subscribe', { stream, connection });
          } else if (event === 'reinitial-state' && connection.id === id) {
            e(data, { ...record, grid: 0 });
          } else if (event === 'data' && connection.id === id) {
            e(data, { ...record, grid: -1 });
          } else if (event === 'result' && connection.id === id) {
            e(data, { ...record, grid: -1 });
          }
        };
      });
    });
  }

  static ups() {
    const factor = UPS.ups / 1000;
    return new Stream2([], (e, controller) => {
      let globalCounter = 0;
      const startttmp = getTTMP();
      const sid = setInterval(() => {
        const current = getTTMP();
        const count = (current - startttmp) * factor - globalCounter | 0;
        if (count > 10000) throw 'Uncounted err';
        for (let i = 0; i < count; i++) {
          globalCounter++;
          e(globalCounter, { ttmp: startttmp + globalCounter * factor | 0 });
        }
      }, 500 / UPS.ups);
      controller.todisconnect(() => clearInterval(sid));
    });
  }
}

export const stream2 = (...args) => new Stream2(...args);
// static props recalc to stream2
Object.getOwnPropertyNames(Stream2)
  .filter((prop) => typeof Stream2[prop] === 'function')
  .map((prop) => stream2[prop] = Stream2[prop]);

export class RemouteService extends Stream2 {
  /**
   * @param {host, port} websocketconnection settings
   */
  static fromWebSocketConnection({ host, port }) {
    let websocketconnection = null;
    let remouteserviceconnectionstatus = null;
    const STMPSuncData = { remoute: -1, connected: -1, current: -1 };
    return new RemouteService(null, (e, controller) => {
      if (!websocketconnection) {
        websocketconnection = new WebSocket(`ws://${host}:${port}`);
        UPS.subscribe((stmp) => STMPSuncData.current = stmp);
      }
      function onsocketmessagehandler({ data: raw }) {
        const msg = JSON.parse(raw);
        if (msg.event === 'remote-service-ready') {
          STMPSuncData.remoute = msg.stmp;
          STMPSuncData.connected = UPS.current;
          remouteserviceconnectionstatus = 'ready';
          e(msg);
        } else if (msg.event === 'data') {
          e(msg);
        }
      }
      function onsocketopendhandler() {
        controller.tocommand((request, data) => {
          if (request === 'subscribe') {
            websocketconnection.send(JSON.stringify({ ...data, request }));
          }
          if (request === 'command') {
            const stmp = STMPSuncData.remoute - STMPSuncData.connected - data.stmp;
            websocketconnection.send(JSON.stringify({ ...data, stmp, request }));
          }
        });
      }
      if (websocketconnection.readyState === WebSocket.OPEN) {
        onsocketopendhandler();
      } else {
        websocketconnection.addEventListener('open', onsocketopendhandler);
        controller.todisconnect(() => {
          socket.removeEventListener('open', onsocketopendhandler);
        });
      }
      if (remouteserviceconnectionstatus === 'ready') {
        e({ event: 'remote-service-ready', connection: { id: -1 }, data: null });
      }
      websocketconnection.addEventListener('message', onsocketmessagehandler);
      controller.todisconnect(() => {
        websocketconnection.removeEventListener('message', onsocketmessagehandler);
      });
    });
  }
}

Stream2.FROM_OWNER_STREAM = FROM_OWNER_STREAM;
Stream2.TYPES = TYPES;
const { isKeySignal } = Stream2;

const UPS = new class {
  constructor() {
    this.subscribers = [];
    this.sid = -1;
  }

  set(ups) {
    this.ups = ups;
  }

  tick(stmp, ttmp) {
    this.subscribers.map((subscriber) => subscriber(stmp, ttmp));
  }

  subscribe(subscriber) {
    if (this.sid === -1) {
      // todo async set at UPS state value
      // const factor = this.ups / 1000;
      let globalCounter = 0;
      const startttmp = getTTMP();
      this.sid = setInterval(() => {
        const factor = this.ups / 1000;
        const current = getTTMP();
        // eslint-disable-next-line no-bitwise
        const count = (current - startttmp) * factor - globalCounter | 0;
        for (let i = 0; i < count; i += 1) {
          globalCounter += 1;
          // eslint-disable-next-line no-bitwise
          this.tick(globalCounter, startttmp + globalCounter * factor | 0);
        }
      }, 500 / this.ups);
    }
    this.subscribers.push(subscriber);
  }

  unsubscribe(subscriber) {
    const removed = this.subscribers.indexOf(subscriber);
    /* <debug> */
    if (removed < 0) throw new Error('Attempt to delete an subscriber out of the container');
    /* </debug> */
    this.subscribers.splice(removed, 1);
  }
}();

stream2.UPS = UPS;
