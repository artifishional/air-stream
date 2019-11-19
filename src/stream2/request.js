// TODO: Simplify mb? Redundant structure
export class Request {
	
	constructor(rec) {
		this.record = rec;
		this.subscribers = new Set();
		this.isconfirmed = -1;
	}
	
	confirm() {
		this.isconfirmed = 1;
		this.subscribers.forEach( handler => handler(this) );
	}
	
	on(subscriber) {
		this.subscribers.add(subscriber);
	}
	
	off(subscriber) {
		this.subscribers.delete(subscriber);
	}
	
	cancel() {
		this.isconfirmed = 0;
	}
	
}