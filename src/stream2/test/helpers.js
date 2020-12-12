// eslint-disable-next-line import/prefer-default-export
export class DomEvent {
  constructor() {
    this.handlers = [];
  }

  addEventListener(type, cb) {
    this.handlers.push({ type, cb });
  }

  removeEventListener(type, cb) {
    this.handlers.findIndex((x) => x.type === type && x.cb === cb);
  }

  dispatchEvent(event) {
    setTimeout(() => {
      this.handlers
        .filter(({ type }) => type === event.type)
        .forEach(({ cb }) => cb(event));
    });
  }
}
