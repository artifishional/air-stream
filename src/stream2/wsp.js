import { DEFAULT_TOKEN, EMPTY } from './signals';

let LOCAL_WELLSPRING_ID_COUNTER = 0;

export const TTMP = new class TTMPSyncController {

	constructor () {
		this.token = null;
		this.cbs = [];
	}

	get(ttmp = -1) {
		if(!this.token) {
			if(ttmp === -1) ttmp = globalThis.performance.now();
			this.token = { sttmp: ttmp };
			debugger;
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

export class WSP {

	constructor( id = LOCAL_WELLSPRING_ID_COUNTER ++ ) {
		this.id = id;
		this.lastedstoken = DEFAULT_TOKEN;
	}
	
	rec(value, ttmp) {
		const token = TTMP.get(ttmp);

		debugger;

		/*<@debug>*/
		if(token === this.lastedstoken || this.lastedstoken.sttmp >= token.sttmp) {
			throw new Error("More than one event at a time for the current source");
		}
		/*</@debug>*/
		this.lastedstoken = token;
		return new Record( this, value, token );
	}
	
}

export class Record {
	
	constructor( owner, value, token, origin = this, empty = false ) {
		this.origin = origin;
		this.value = value;
		this.owner = owner;
		this.token = token;
		this.sttmp = token.sttmp;
		this.empty = empty;
	}
	
	map(fn) {
		if(this.empty) {
			return this;
		}
		return new Record( this.owner, fn(this.value, this), this.token, this.origin );
	}
	
	createEmpty() {
		return new Record( this.owner, EMPTY, this.token, this.origin, true );
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
		return new Record( this.owner, value, this.token, this.origin );
	}
	
}