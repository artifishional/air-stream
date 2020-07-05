import ReT4 from './retouch-base';
import { RET4_TYPES } from './retouch-types';

export default class ReT4ReConstruct extends ReT4 {
  constructor(owner, { origin }) {
    super(owner, RET4_TYPES.ReCONSTRUCT);
    /**
     * Данные активации для каждого входного стрима
     * @type {Array.<Array.<RedRecord>>}
     */
    this.acc = [];
    this.origin = origin;
  }

  /**
   * @param {RedWSP} rwsp
   * @param {Array.<RedRecord>} reT4Data
   */
  fill(rwsp, reT4Data) {
    // если данный накопитель - первоисточник
    if (!this.owner.wsps) {
      this.complete(reT4Data);
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
      if (this.acc.length === this.owner.wsps.length) {
        const updates = this.acc
          .flat()
          .sort(({ token: { sttmp: a } }, { token: { sttmp: b } }) => a - b);
        this.complete(updates);
      }
      /**
       * Остальную работу сделает WSP -
       * он синхронизирует записи согласно общим источникам
       * здесь достаточно соблюсти последовательность событий
       */
    }
  }
}
