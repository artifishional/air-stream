let pending = null;

function ctd() {
  const run = pending;
  pending = null;
  run.forEach((task) => {
    task.queue();
  });
}

export default class AsyncTask {
  constructor(task, ctx = null) {
    this.task = task;
    this.ctx = ctx;
    this.canceled = false;
    if (!pending) {
      queueMicrotask(ctd);
      pending = [];
    }
    pending.push(this);
  }

  queue() {
    if (!this.canceled) {
      this.ready();
    }
  }

  update(data) {
    this.data = data;
  }

  cancel() {
    this.canceled = true;
  }

  ready() {
    this.task.call(this.ctx, this.data);
  }
}
