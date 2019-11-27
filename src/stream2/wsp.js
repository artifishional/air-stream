import { EMPTY } from './signals';

let LOCAL_WELLSPRING_ID_COUNTER = 0;

const TTMP = new class TTMPSyncController {

	constructor () {
		this.sttmp = -1;
	}

	get(ttmp) {
		if(this.sttmp === -1) {
			if(ttmp === -1) ttmp = window.performance.now();
			this.sttmp = ttmp;
			queueMicrotask(() => this.sttmp = -1);
		}
		return this.sttmp;
	}

};

export class WSP {

	constructor( id = LOCAL_WELLSPRING_ID_COUNTER ++ ) {
		this.id = id;
		this.lastedsttmp = -1;
	}
	
	rec(value, ttmp) {
		const sttmp = TTMP.get(ttmp);
		/*<@debug>*/
		if(this.lastedsttmp >= sttmp) {
			throw new Error("More than one event at a time for the current source");
		}
		/*</@debug>*/
		this.lastedsttmp = sttmp;
		return new Record( this, value, sttmp );
	}
	
}

export class Record {
	
	constructor( owner, value, sttmp, origin = this, empty = false ) {
		this.origin = origin;
		this.value = value;
		this.owner = owner;
		this.sttmp = sttmp;
		this.empty = empty;
	}
	
	map(fn) {
		if(this.empty) {
			return this;
		}
		return new Record( this.owner, fn(this.value, this), this.sttmp, this.origin );
	}
	
	createEmpty() {
		return new Record( this.owner, EMPTY, this.sttmp, this.origin, true );
	}

	filter(fn) {
		if(this.empty) {
			return this;
		}
		if(fn(this.value, this)) {
			return this;
		}
		else {
			return this.createEmpty();
		}
	}
	
	from(value) {
		return new Record( this.owner, value, this.sttmp, this.origin );
	}
	
}