import WSP from './wsp';


export default class RedSlaveWSP extends WSP {
  constructor(streams, hnProJ) {
    super();
    this.hn = hnProJ(this);
    if (streams.length === 1) {
      this.state = streams.state.map((rec) => rec.from(this.hn(
        // updates.map(([stream, _rec]) => [rec.value, stream, _rec]),
      )));
    }
  }

  handleR(/* state */) {
    // логика работы аналогична работе с кадрами
    // если общее состояние одного из накопителей меняется
    // то нужно дождаться изменения состояний всех связанных накопителей
    // затем необходимо произвести обновление
    return this;
  }
}
