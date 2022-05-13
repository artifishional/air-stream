/**
 * Упаковщик возращаемых данных для методов трансформаций,
 * требующих в том числе технические данные
 */
export default class WSPSSetupResult {
  /**
   * @param {RedWSP[]} wsps
   */
  constructor(wsps) {
    this.wsps = wsps;
  }
}
