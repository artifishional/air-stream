import RedWSP from './rwsp';


export default class RedWSPSlave extends RedWSP {
  onReT4Complete(updates) {
    const state = [];
    const combined = [];
    updates.forEach((wave) => {
      wave.forEach(([idx, rec]) => {
        combined[idx] = rec;
      });
      if (combined.length < this.streams.size || combined.includes(undefined)) {
        return;
      }
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
}
