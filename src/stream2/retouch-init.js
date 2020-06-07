import ReT4 from './retouch-base';
import { RET4_TYPES } from './retouch-types';


export default class ReT4Init extends ReT4 {
  constructor(owner) {
    super(owner);
    /**
     * Данные активации для каждого входного стрима
     * @type {Array.<Array.<RedRecord>>}
     */
    this.acc = [];
  }

  /**
   * @param {RedWSP} rwsp
   * @param {Array.<RedRecord>} reT4Data
   */
  fill(rwsp, reT4Data) {
    // если данный накопитель - первоисточник
    if (!this.owner.streams) {
      this.owner.onReT4Complete(RET4_TYPES.ReINIT, reT4Data);
      // или все источники заполнены
    } else {
      /**
       * Так как невозможно объединять события с одинаковыми ttmp
       * в одну запись (для разных исчтоников) их необходимо сортировать
       */
      /**
       * Сейчас остается проблема: если два события от разных источников
       * произовшли одновременно, то необходим механизм
       * разрешения очередности их срабатывания
       */
      /**
       * TODO:
       *  Очередность должна регулироваться порядком следования
       *  первоисточников в массиве
       */
      this.acc.push(reT4Data);
      if (this.acc.length === this.owner.streams.size) {
        // TODO: need perf optimization
        const updates = this.acc
          .reduce(
            (acc, next, idx) =>
              // eslint-disable-next-line
              [...acc, ...next.map((rec) => [idx, rec])], [],
          )
          .sort(
            ([idxA, recA], [idxB, recB]) =>
              // eslint-disable-next-line
              recA.token.sttmp - recB.token.sttmp || idxA - idxB,
          )
          .reduce((acc, [idx, next]) => {
            const lastAcc = acc[acc.length - 1];
            if (lastAcc[0] === next.token) {
              lastAcc[1].push([idx, next]);
            } else {
              acc.push([next.token, [[idx, next]]]);
            }
            return acc;
          }, [[-1, []]])
          .map(([, rec]) => rec);
        this.owner.onReT4Complete(RET4_TYPES.ReINIT, updates.slice(1));
      }
    }
  }
}
