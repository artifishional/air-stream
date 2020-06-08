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
    if (!this.owner.wsps) {
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
      if (this.acc.length === this.owner.wsps.length) {
        const updates = this.acc
          .flat()
          .sort(({ token: { sttmp: a } }, { token: { sttmp: b } }) => a - b);
        this.owner.onReT4Complete(RET4_TYPES.ReINIT, updates);
      }
      /**
       * Остальную работу сделает WSP -
       * он синхронизирует записи согласно общим источникам
       * здесь достаточно соблюсти последовательность событий
       */
    }
  }
}
