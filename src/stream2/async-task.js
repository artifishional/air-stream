export default class AsyncTask {
  constructor(task, ctx = null) {
    this.task = task;
    this.ctx = ctx;
    this.canceled = false;
    queueMicrotask(() => !this.canceled && this.ready());
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
