import { DEFAULT_TOKEN, EMPTY } from './signals';
import STTMP from './sync-ttmp-ctr';
import Record from './record';
import Propagate from './propagate';
import { STATIC_CREATOR_KEY } from './defs';
import SyncEventManager from './sync-event-manager';
import SyncEventManagerSingle from './sync-event-manager-single';

let staticOriginWSPIDCounter = 0;

export default class WSP {
  /**
   * @param {Array.<WSP|RedWSP>|null} wsps Список источников входных данных
   * @param {*} args
   * @param {Object = undefined} creatorKey
   */
  constructor(
    wsps = null,
    args,
    /* <debug> */ creatorKey, /* </debug> */
  ) {
    if (!wsps) {
      staticOriginWSPIDCounter += 1;
      this.id = staticOriginWSPIDCounter;
    }
    this.wsps = wsps;
    /* <debug> */
    if (creatorKey !== STATIC_CREATOR_KEY) {
      throw new TypeError('Only static constructor supported');
    }
    /* </debug> */
    /* <debug> */
    if (wsps) {
      if (wsps.some((stream) => !(stream instanceof WSP))) {
        throw new TypeError('Only WSP supported');
      }
    }
    /* </debug> */
    /**
     * @property {Set<WSP>}
     */
    this.slaves = new Set();
    this.hnProJ = null;
    this.lastedstoken = DEFAULT_TOKEN;
    this.curFrameCachedRecord = null;
    if (!wsps) {
      this.originWSpS = [this];
    } else {
      this.originWSpS = [...new Set(wsps.map(({ originWSpS }) => originWSpS).flat(1))];
    }
    /* <debug> */
    if (this.originWSpS.some((wsp) => !(wsp instanceof WSP))) {
      throw new TypeError();
    }
    /* </debug> */
    this.sncMan = this.createSyncEventMan();
  }

  createSyncEventMan() {
    if (!this.wsps || this.wsps.length < 2) {
      return new SyncEventManagerSingle(this);
    }
    return new SyncEventManager(this);
  }

  handleR(src, cuR) {
    this.sncMan.fill(src, cuR);
  }

  sncGrpFilledHandler(updates) {
    this.next(this.createRecordFromUpdates(updates));
  }

  createRecordFromUpdates(updates) {
    const filtered = updates.filter(({ value }) => value !== EMPTY);
    if (!filtered.length) {
      return this.createRecordFrom(updates[0], EMPTY);
    }
    return this.createRecordFrom(filtered[0], this.hn(filtered));
  }

  with(hnProJ) {
    this.initiate(hnProJ);
  }

  static combine(wsps, proJ) {
    const res = new this(
      wsps,
      {},
      /* <debug> */ STATIC_CREATOR_KEY, /* </debug> */
    );
    res.initiate(() => {
      const combined = new Map();
      return (updates) => {
        updates.forEach(({ src, value }) => combined.set(src, value));
        if (combined.size === wsps.length) {
          return proJ([...combined.values()]);
        }
        return EMPTY;
      };
    });
    return res;
  }

  /**
   * @param {Function|null = null} hnProJ
   */
  initiate(hnProJ) {
    this.hnProJ = hnProJ;
    if (!this.hn && this.hnProJ) {
      this.hn = this.hnProJ(this);
    }
    if (this.wsps) {
      this.wsps.map((stream) => stream.on(this));
    }
  }

  static create(wsps, hnProJ = null, args = {}) {
    const res = new this(
      wsps,
      args,
      /* <debug> */ STATIC_CREATOR_KEY, /* </debug> */
    );
    if (hnProJ) {
      res.initiate(hnProJ);
    }
    return res;
  }

  static fromCbFunc(cb) {
    const res = WSP.create();
    cb((data) => res.burn(data));
    return res;
  }

  static fromFn(fn) {
    const res = WSP.create();
    res.burn(fn());
    return res;
  }
/*
  handleR(stream, cuR) {
    // grouping
    // каждое сообщение (или группу если поддерживается несколько событий
    // в рамках одного sttmp) из солид необходимо разместить в ячейке
    // для исходного потока и для исходного sttmp
    // так как после каждого события необходимо дождаться ответа от всех
    // потоков, а также необходимо сохранять очередность использования данных
    // в функции хендлера согласно очередности потоков в this.streams
    // синхронизируются сообщения только ОДНОГО источника
    if (!this.event5tore) {
      this.event5tore = new Map();
    }
    const exist = this.event5tore;
    // потоки, которые должны быть синхронизированы для данного источника
    let streamExist = exist.get(cuR.owner);
    const neighbours = this.neighbourStreamsBySource.get(cuR.owner);
    // если потоки еще не были определены
    if (!streamExist) {
      exist.set(
        cuR.owner,
        streamExist = new Map(
          neighbours
            .map(({ stream: _stream }) => [_stream,
              null, // cuR from stream from cur sttmp
            ]),
        ),
      );
    // если формирование массива исходных потоков происходит динамически
    // (одновременно с получением данных из потоков)
    } else if (streamExist.size !== neighbours.length) {
      exist.set(cuR.owner, streamExist = new Map(
        neighbours
          .map(({ stream: _stream }) => [_stream, streamExist.get(_stream)]),
      ));
    }
    // текущее значение для данного потока
    streamExist.set(stream, cuR);
    const event5tore = [...this.event5tore.keys()];
    // TODO: need perf refactor
    for (let i = 0; i < event5tore.length; i += 1) {
      const streams = [...this.event5tore.get(event5tore[i])];
      // TODO: любая первая запись
      const rec = streams[0][1];
      // only synced msg's here
      // здесь также все токены головной записи должны совпадать,
      // так как действие происходит от одного источника,
      // а при откате, токен записи обновляется
      if (streams.some(([, _rec]) => !_rec)
        || new Set(streams.map(({ token }) => token)).size > 1
      ) {
        return;
      }
      this.event5tore.delete(event5tore[i]);
      const updates = streams.filter(([, _rec]) => _rec.value !== EMPTY);
      if (updates.length) {
        this.next(this.createRecordFrom(rec, this.hn(
          updates.map(([, _rec]) => _rec),
        )));
      } else {
        this.next(this.createRecordFrom(rec, EMPTY));
      }
    }
  }
*/

  createRecordFrom(rec, updates) {
    return rec.from(updates, Record, undefined, this);
  }

  off(slv) {
    this.slaves.delete(slv);
  }

  /**
   * @param {WSP} slv
   */
  on(slv) {
    // TODO: Записи придут одна за другой от разных handler,
    //  но одного controller
    if (this.curFrameCachedRecord && this.curFrameCachedRecord[0].token === STTMP.get()) {
      this.curFrameCachedRecord.map((cuR) => slv.handleR(this, cuR));
    } else {
      this.curFrameCachedRecord = null;
    }
    this.slaves.add(slv);
  }

  get(proJ) {
    return WSP.create([this],
      () => ([[update]]) => {
        proJ(update);
        return update;
      });
  }

  next(rec) {
    if (!this.curFrameCachedRecord) {
      this.curFrameCachedRecord = [];
    }
    this.curFrameCachedRecord.push(rec);
    this.slaves.forEach((slv) => slv.handleR(this, rec));
  }

  /**
   * Конструктор новых событий (handle)
   * @param value
   * @param token
   */
  burn(value, token = STTMP.get()) {
    /* <@debug> */
    if (token === this.lastedstoken || this.lastedstoken.sttmp >= token.sttmp) {
      throw new Error('More than one event at a time for the current source');
    }
    this.lastedstoken = token;
    /* </@debug> */
    this.next(Propagate.burn(value, token, this));
  }

  map(proJ) {
    return WSP.create([this],
      () => ([value]) => proJ(value));
  }

  filter(proJ) {
    return WSP.create(
      [this],
      () => ([update]) => (proJ(update) ? update.value : EMPTY),
    );
  }
}

/* <@debug> */
// eslint-disable-next-line no-undef
globalThis.WSP = WSP;
/* </@debug> */
