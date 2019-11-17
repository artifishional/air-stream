let LOCAL_WELLSPRING_ID_COUNTER = 0;

export class WSpring {

	constructor( id = LOCAL_WELLSPRING_ID_COUNTER ++ ) {
		this.id = id;
	}
	
	rec(value, ttmp = performance.now()) {
		return new OriginRecord( this, value, ttmp );
	}
	
}

export class Record {
	
	constructor( value, origin = this ) {
		this.value = value;
		this.origin = origin;
		this.ttmp = origin.ttmp;
	}
	
	map(fn) {
		return new Record( fn(this.value), this.origin );
	}

}

export class OriginRecord extends Record {
	
	constructor( owner, value, ttmp ) {
		super(value);
		this.owner = owner;
		this.ttmp = ttmp;
	}

}