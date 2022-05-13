/**
 * Упаковщик возращаемых данных для методов трансформаций,
 * требующих в том числе технические данные
 */
export default class ExtendedResult {
  /**
   * @param {*} data
   * @param {Stream2[]} streams
   */
  constructor(streams, data = null) {
    this.data = data;
    this.streams = streams;
  }
}
