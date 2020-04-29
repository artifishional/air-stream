import RedWSP from './rwsp';
import { RED_REC_SUBORDINATION } from './red-record';
import { EMPTY } from './signals';


export default class RedWSPSlave extends RedWSP {
  /**
   * @augments RedWSP
   * @param {Array.<WSP|RedWSP>|null} wsps Список источников входных данных
   * @param {Function} hnProJ
   * @param {Boolean = false} reT4able Reinit getter when reT4
   */
  constructor(wsps, hnProJ = null, { reT4able = false } = {}) {
    super(wsps, hnProJ, { subordination: RED_REC_SUBORDINATION.SLAVE, reT4able });
  }

  onReT4Complete(updates) {
    // TODO: DUPLICATE BASE CH.
    if (!this.hn || this.reT4able) {
      this.hn = this.hnProJ(this);
    }
    const state = [];
    const combined = [];
    updates.forEach((wave) => {
      wave.forEach(([idx, rec]) => {
        combined[idx] = rec;
      });
      if (combined.length < this.streams.size || combined.includes()) {
        return;
      }
      this.combined = combined;
      state.push(this.createRecordFrom(
        wave[0][1],
        this.hn(
          wave.map(([, rec]) => rec),
          combined,
        ),
      ));
    });
    this.incompleteRet4 = null;
    return this.open(state);
  }

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
        updates.forEach(([wsp, update]) => {
          this.combined[this.streams.get(wsp).idx] = update;
        });
        this.next(this.createRecordFrom(rec, this.hn(
          updates.map(([, _rec]) => _rec),
          this.combined,
        )));
      } else {
        this.next(this.createRecordFrom(rec, EMPTY));
      }
    }
  }
}
