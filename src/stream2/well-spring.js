let LOCAL_WELLSPRING_ID_COUNTER = 0;

const TTMP = new class TTMPSyncController {

	constructor () {
		this.sttmp = -1;
	}

	get(ttmp) {
		if(this.sttmp === -1) {
			if(ttmp === -1) ttmp = window.performance.now();
			this.sttmp = ttmp | 0;
			queueMicrotask(() => this.sttmp = -1);
		}
		return this.sttmp;
	}

};

export class WSpring {

	constructor( id = LOCAL_WELLSPRING_ID_COUNTER ++ ) {
		this.id = id;
	}
	
	rec(value, ttmp) {
		return new Record( this, value, TTMP.get(ttmp) );
	}
	
}

export class Record {
	
	constructor( owner, value, sttmp, origin = this ) {
		this.origin = origin;
		this.value = value;
		this.owner = owner;
		this.sttmp = sttmp;
	}
	
	map(fn) {
		return new Record( this.owner, fn(this.value), this.sttmp, this.origin );
	}
	
	from(value) {
		return new Record( this.owner, value, this.sttmp, this.origin );
	}
	
}