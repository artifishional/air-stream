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
		return new OriginRecord( this, value, TTMP.get(ttmp) );
	}
	
}

export class Record {
	
	constructor( value, origin = this ) {
		this.value = value;
		this.origin = origin;
		this.sttmp = origin.sttmp;
	}
	
	map(fn) {
		return new Record( fn(this.value), this.origin );
	}

}

export class OriginRecord extends Record {
	
	constructor( owner, value, sttmp ) {
		super(value);
		this.owner = owner;
		this.sttmp = sttmp;
	}

}