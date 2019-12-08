export const STTMP = new class TTMPSyncController {
	
	constructor () {
		this.token = null;
		this.cbs = [];
	}
	
	get(ttmp = -1) {
		if(!this.token) {
			if(ttmp === -1) ttmp = globalThis.performance.now();
			this.token = { sttmp: ttmp };
			queueMicrotask(() => {
				this.token = null;
				this.cbs.map( cb => cb() );
			} );
		}
		return this.token;
	}
	
	async(cb) {
		this.get();
		this.cbs.push(cb);
	}
	
};