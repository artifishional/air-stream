import RedWSP from './wsp/rwsp.mjs';
import RedCon5ionHn from './red-connection-handler.mjs';
import ExtendedResult from './wrapper/extended-result.mjs';
import RedWSPSlave from './wsp/rwsp-slave.mjs';

function arrEquals(arr1, arr2) {
  if (arr1.length !== arr2.length) {
    return false;
  }
  for (let i = 0; i < arr1.length; i += 1) {
    if (arr1[i] !== arr2[i]) {
      return false;
    }
  }
  return true;
}

export default class WSPSchemaTuner {
  constructor(
    headWsp,
    onrdy,
    ctr,
    proJ,
    // TODO: Тюнер нужно разделить на изменение схемы
    //  и хендлер
    tuner = null,
    async = false,
    conf = {},
  ) {
    /* <debug> */
    if (!(headWsp instanceof RedWSP)) {
      // eslint-disable-next-line no-debugger
      debugger;
      throw new TypeError('Unsupported headWsp parameter type.');
    }
    /* </debug> */
    this.headWsp = headWsp;
    this.tuner = tuner;
    this.conf = conf;
    this.proJ = proJ;
    this.async = async;
    this.ctr = ctr;
    this.onrdy = onrdy;
    this.wsp = null;
    this.con5ionHnCTR = new RedCon5ionHn((bags) => this.con5ionHn(bags));
    this.ctr = ctr;
    // TODO: здесь очень похоже что bags это часть ответсвенности
    //  RedCon5ionHn в котором также есть streams
    this.bags = null;
    this.after5fullUpdateCTD = null;
  }

  processCNF(cnf) {
    if (this.bags === null) {
      this.bags = [];
    }
    let isChanged = false;
    for (let i = 0; i < cnf.length; i += 1) {
      let box = cnf[i];
      if (!Array.isArray(box)) {
        // eslint-disable-next-line
        box = [box, { on: true, key: -1, src: null, hook: null }];
      }
      const idx = this.bags.findIndex(([x]) => x === box[0]);
      if (idx > -1) {
        if (box.key !== -1) {
          this.bags[idx][1].key = box[1].key;
        } else {
          this.bags[idx][1].key = idx;
        }
        if (!box[1].on) {
          this.bags.splice(idx, 1);
          isChanged = true;
        }
      } else if (box[1].on) {
        this.bags.push(box);
        isChanged = true;
      }
    }
    return isChanged;
  }

  add(streams) {
    this.setup(streams.map((stream) => [stream, { on: true, key: -1 }]));
  }

  after5fullUpdateHn() {
    if (!this.after5fullUpdateCTD) {
      // this.after5fullUpdateCTD = new AsyncTask(this.after5fullUpdateCTDrdy, this);
      this.after5fullUpdateCTDrdy();
    }
  }

  after5fullUpdateCTDrdy() {
    this.after5fullUpdateCTD = null;
    this.tuner(this, this.wsp.getLastStateValue());
  }

  con5ionHn(con5ion) {
    con5ion.streams.forEach(({ wsp, hook }, idx) => {
      this.bags[idx][1].wsp = wsp;
      this.bags[idx][1].hook = hook;
    });
    if (!this.wsp) {
      this.ctr.link(this);
      this.wsp = RedWSPSlave.extendedCombine(
        [this.headWsp, ...con5ion.streams.map(({ wsp }) => wsp)],
        () => ([head, ...streams]) => {
          if (!head.length) {
            return this.proJ([]);
          }
          const res = this.proJ(streams);

          if (res instanceof ExtendedResult) {
            this.accurate(res.streams);
            return res.data;
          }

          return res;
        },
        this.tuner && this,
        this.conf,
      );
      this.onrdy(this.wsp);
    } else {
      this.wsp.setup(con5ion.streams.map(({ wsp }) => wsp));
    }
  }

  /**
   * Пример когда поток является источником инфомарции о своем
   *  присутсвии: Поток, который ожидает своего завершения перед
   *  отключением (fade-out) в варианте стоячего масштабирования
   *
   * Пример необходимости рекурсивного масштабирования: Загрузка ресурсов:
   *  каждый ресурс может ссылаться на дополнительные зависимости
   *  которые обновляют список общих зависимостей
   *
   * Однако, при добавлении потока с базовым источником текущего сообщения
   *
   *
   * Пример когда каждый новый добавленный поток тащит за собой
   *  еще один такой же поток, что приводит к бесконечному перерасчету
   *  состояния в варианте рекурсивного масштабирования
   *
   *
   * source = (id) => {
   *   return [source(id + 1)];
   * }
   *
   *  (streamsData) => {
   *    return streamsData.flat();
   *  }, (mappedDataStreams) => {
   *    return mappedDataStreams;
   *  }
   */

  /**
   * Перенастройка входящих потоков (с учетом последовательности).
   *
   * @param streams {Stream2[]} Входящие потоки.
   */
  accurate(streams) {
    if (!this.bags || !arrEquals(this.bags.map(([x]) => x), streams)) {
      this.bags = streams.map(
        (box) => [box, {
          on: true, key: -1, src: null, hook: null,
        }],
      );
      if (this.after5fullUpdateCTD) {
        this.after5fullUpdateCTD.cancel();
        this.after5fullUpdateCTD = null;
      }
      this.con5ionHnCTR.reconnect(this.bags.map(([stream]) => stream));
    }
  }

  setup(cnf) {
    if (!this.processCNF(cnf)) {
      return;
    }
    if (this.after5fullUpdateCTD) {
      this.after5fullUpdateCTD.cancel();
      this.after5fullUpdateCTD = null;
    }
    this.con5ionHnCTR.reconnect(this.bags.map(([stream]) => stream));
  }

  // не создавать промежуточных котнроллеров там,
  //  где они сохраниют прежний вид
  //  но оставлять возможность внедрять их в процессе
  handleCTR(req, data) {
    this.bags.forEach(([, { hook }]) => hook(req, data));
  }

  /**
   * @param {string|number} key
   */
  get(key) {
    const own = this;
    return {
      key,
      get value() {
        return own.bags[key][1].wsp.getLastStateValue();
      },
      get src() {
        return own.bags[key][1].wsp;
      },
      get stream() {
        return own.bags[key][0];
      },
      get hook() {
        // TODO: may be unsubscribe checks is needed
        return own.bags[key][1].hook;
      },
    };
  }
}

// TODO: temporary solution
export class WSPSchemaTuner2 extends WSPSchemaTuner {
  constructor(...args) {
    const withTuner = args[4];
    // eslint-disable-next-line no-param-reassign
    args[4] = null;
    const proJ = args[3];

    if (withTuner) {
      // eslint-disable-next-line no-param-reassign
      args[3] = (...parm) => {
        const res = proJ(...parm);
        this.setup(res[1]);
        return res[0];
      };
    }

    super(...args);
  }

  con5ionHn(con5ion) {
    con5ion.streams.forEach(({ wsp, hook }, idx) => {
      this.bags[idx][1].wsp = wsp;
      this.bags[idx][1].hook = hook;
    });

    if (!this.wsp) {
      this.ctr.link(this);
      this.wsp = RedWSPSlave.extendedCombine(
        con5ion.streams.map(({ wsp }) => wsp),
        () => this.proJ,
        this.tuner && this,
        this.conf,
      );
      this.onrdy(this.wsp);
    } else {
      this.wsp.setup(con5ion.streams.map(({ wsp }) => wsp));
    }
  }
}
