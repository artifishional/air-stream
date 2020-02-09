import getTTMP from './get-ttmp';
import { CONNECT } from './signals';
import WSP from './wsp';
import Record from './record';
import {RED_REC_LOCALIZATION, RED_REC_SUBORDINATION} from "./red-record";
import RedWSPSlave from "./rwsp-slave";


const EMPTY_OBJECT = Object.freeze({ empty: 'empty' });
const EMPTY_FN = () => EMPTY_OBJECT;
const FROM_OWNER_STREAM = Object.freeze({ fromOwnerStream: 'fromOwnerStream' });
let GLOBAL_CONNECTIONS_ID_COUNTER = 1;
const STATIC_PROJECTS = {
  STRAIGHT: (data) => data,
  AIO: (...args) => args,
};
const USER_EVENT = {};

const TYPES = { PIPE: 0, STORE: 1 };

export class Stream2 {
  constructor(proJ, ctx = null) {
    this.connections = new Map();
    /* <@debug> */
    this.$label = '';
    /* </@debug> */
    this.project = proJ;
    this.ctx = ctx;
    this.type = new.target.TYPES.PIPE;
  }

  get(getter) {
    return new Stream2((connect, control) => {
      this.connect((evtChWSpS, hook) => {
        control.to(hook);
        connect(evtChWSpS);
        return (rec) => getter(rec.value, rec);
      });
    }).connect();
  }

  static fromevent(target, event) {
    return new Stream2([], (e, controller) => {
      e(CONNECT, USER_EVENT);
      target.addEventListener(event, e);
      controller.todisconnect(() => target.removeEventListener(event, e));
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

  /* <@debug> */
  label(label) {
    this.$label = label;
    return this;
  }
  /* </@debug> */

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

  fromCbFunc(loader) {
    return new Stream2((cNect) => {
      loader(cNect());
    }).store();
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

  static with(wsps, hnProJ, { localization = null, subordination = null } = {}) {
    /* <@debug> */
    if (wsps.length !== 1 && subordination === RED_REC_SUBORDINATION.MASTER) {
      throw new TypeError(
        'Unsupported configuration type. Master WSP can have no more than one source',
      );
    }
    /* <@/debug> */
    const calculableConfig = {
      localization,
      subordination,
    };
    if (!localization) {
      if (wsps.some((wsp) => wsp.localization === RED_REC_LOCALIZATION.LOCAL)) {
        calculableConfig.localization = RED_REC_LOCALIZATION.LOCAL;
      } else {
        calculableConfig.localization = RED_REC_LOCALIZATION.REMOTE;
      }
    }
    if (!subordination) {
      calculableConfig.subordination = RED_REC_SUBORDINATION.SLAVE;
    }
    return new RedWSPSlave(
      wsps,
      hnProJ,
      calculableConfig,
    );
  }

  // канал является переходит в состояние включен
  // когда получает ссылку на эмитер при вызове connect

  get(getter) {
    return new Stream2((connect, control) => {
      this.connect((/* evtChWSpS, */own, hook) => {
        control.to(hook);
        connect(own.get(getter));
        // return rec => getter(rec.value, rec)
      });
    }).connect();
  }

  map(proJ) {
    return new Stream2((connect, control) => {
      this.connect((/* evtChWSpS, */own, hook) => {
        control.to(hook);
        // источники должны быть привязаны к own instance
        connect(/* evtChWSpS, */own.map(proJ));
        // return rec => e(rec.map(proJ));
      });
    });
  }

  filter(proJ) {
    return new Stream2((connect, control) => {
      this.connect((evtChWSpS, hook, own) => {
        control.to(hook);
        const e = connect(evtChWSpS, own);
        return (rec) => e(rec.filter(proJ));
      });
    });
  }

  /* <@debug> */
  log() {
    return new Stream2((conect, control) => {
      this.connect((evtChWSpS, hook) => {
        control.to(hook);
        const e = conect(evtChWSpS);
        return (rec) => {
          console.log(rec.value);
          e(rec);
        };
      });
    });
  }
  /* </@debug> */

  connect(connect = () => () => {}) {
    this.connections.set(connect, null);
    const control = this.createController();
    const hook = (action = 'disconnect', data = null) => {
      /* <@debug> */
      if (typeof action !== 'string') {
        throw new TypeError('Action must be a string only');
      }
      /* </@debug> */
      if (action === 'disconnect') {
        this._deactivate(connect, control);
      } else {
        control.send(action, data);
      }
    };
    this._activate(control, connect, hook);
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

  registerSubscriber(connect, subscriber) {
    // if deactivation occurred earlier than the subscription
    if (this.connections.has(connect)) {
      this.connections.set(connect, subscriber);
    }
  }

  $activate(control = this.createController(), connect, hook) {
    this.project.call(
      this.ctx,
      (evtChWSpS, own = this) => this.startConnectionToSlave(connect, evtChWSpS, own, hook),
      control,
    );
  }

  startConnectionToSlave(connect, evtChWSpS, own, hook) {
    // when projectable stream connecting rdy
    const subscriber = connect(evtChWSpS, hook, own);
    this.registerSubscriber(connect, subscriber);
    return this.createEmitter(subscriber, evtChWSpS);
  }

  $deactivate(connect, controller) {
    this.connections.delete(connect);
    controller.send('disconnect', null);
  }

  createEmitter(subscriber, evtChWSpS) {
    /* <@debug> */
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
    /* </@debug> */
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

  static combine(sourcestreams, project = (...streams) => streams) {
    if (!sourcestreams.length) {
      return new Stream2(null, (e) => {
        e(project());
      });
    }
    return new Stream2(sourcestreams, (e, controller) => {
      const sourcestreamsstate = new Array(sourcestreams.length).fill(EMPTY_OBJECT);
      sourcestreams.map((stream, i) => stream.connect((hook) => {
        controller.to(hook);
        return (data, record) => {
          if (Observable.keys.includes(data)) {
            return e(data, record);
          }
          sourcestreamsstate[i] = data;
          if (!sourcestreamsstate.includes(EMPTY_OBJECT)) {
            e(project(...sourcestreamsstate), record);
          }
        };
      }));
    });
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

export class Controller {
  constructor(src) {
    this.src = src;
    this.disconnected = false;
    this.$todisconnect = [];
    this.$tocommand = [];
  }

  todisconnect(...connectors) {
    this.$todisconnect.push(...connectors);
  }

  to(...connectors) {
    this.$todisconnect.push(...connectors);
    this.$tocommand.push(...connectors);
  }

  tocommand(...connectors) {
    this.$tocommand.push(...connectors);
  }

  send(action, data) {
    /* <@debug> */
    if (this.disconnected) {
      throw new Error(`${this.src.$label}: This controller is already disconnected`);
    }
    /* </@debug> */
    if (action !== 'disconnect') {
      this.$tocommand.map((connector) => connector(action, data));
    } else {
      this.disconnected = true;
      this.$todisconnect.map((connector) => connector(action, data));
    }
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
    /* <@debug> */
    if (removed < 0) throw new Error('Attempt to delete an subscriber out of the container');
    /* </@debug> */
    this.subscribers.splice(removed, 1);
  }
}();

stream2.UPS = UPS;
