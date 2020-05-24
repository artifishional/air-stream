import WSP from './wsp';
import { EMPTY } from './signals';

export default class UpdatesManager {
  constructor(wsps, cb) {
    this.cb = cb;
    /* <debug> */
    if (wsps.some((stream) => !(stream instanceof WSP))) {
      throw new TypeError('Only WSP supported');
    }
    /* </debug> */
    this.neighbourStreamsBySource = new Map();
    this.originWSpS = [...new Set(wsps.map(({ originWSpS }) => originWSpS).flat(1))];
    const WSPSData = new Map(wsps.map((stream, idx) => [stream, {
      idx,
      stream,
      eventChWSpS: null,
      neighbours: [],
    }]));
    wsps.forEach((wsp) => {
      const streamRelatedData = WSPSData.get(wsp);
      wsp.originWSpS.forEach((_wsp) => {
        // TODO: TypeCheck
        if (!(_wsp instanceof WSP)) {
          throw new TypeError();
        }
        let neighbourStreams = this.neighbourStreamsBySource.get(_wsp);
        if (!neighbourStreams) {
          this.neighbourStreamsBySource.set(_wsp, neighbourStreams = []);
        }
        neighbourStreams.push(streamRelatedData);
      });
    });
    this.event5tore = null;
  }

  handleR(stream, cuR) {
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
              null, /* cuR from stream from cur sttmp */
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
        this.cb(updates.map(([, _rec]) => _rec));
      } else {
        this.cb(EMPTY);
      }
    }
  }
}
