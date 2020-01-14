import {EMPTY} from "./signals";

export class Record {
	
	constructor( src, owner, value, token, head = this ) {
		this.origin = head;
		this.value = value;
		this.owner = owner;
		this.token = token;
	}
	
	map(fn) {
		if(this.value === EMPTY) {
			return this;
		}
		return new Record( this, this.owner, fn(this.value, this), this.token, this.origin );
	}
	
	filter(fn) {
		if(this.value === EMPTY) {
			return this;
		}
		if(fn(this.value, this)) {
			return this;
		}
		else {
			return new Record( this, this.owner, EMPTY, this.token, this.origin );
		}
	}
	
	//TODO: redic. species set
	from(value, species = Record, owner = this.owner, conf) {
		return new species( this, owner, value, this.token, this.origin, conf );
	}
	
}

/**
 * @readonly
 * @enum {number}
 */
export const RED_RECORD_STATUS = {
	PENDING: 	0,
	FAILURE: -1,
	SUCCESS: 	1,
};

/**
 * @readonly
 * @enum {number}
 */
export const RED_RECORD_SUBORDINATION = {
	MASTER: true,
	SLAVE: false,
};

/**
 * @readonly
 * @enum {number}
 */
export const RED_RECORD_LOCALIZATION = {
	LOCAL: true,
	REMOTE: false,
};

export class RedRecord extends Record {
	
	/**
	 * @param {WSP} src Source wsp
	 * @param {WSP} owner Owner stream
	 * @param {*} value
	 * @param {{sttmp:Number}} token Unique ttmp token
	 * @param {Record} head Link on head wsp
	 * @param {Record} author
	 * @param {RED_RECORD_STATUS} status
	 * @param {RED_RECORD_SUBORDINATION} subordination
	 * @param {RED_RECORD_LOCALIZATION} localization
	 */
	constructor (
		src,
		owner,
		value,
		token,
		head,
		{
			subordination = RED_RECORD_SUBORDINATION.MASTER,
			status = RED_RECORD_STATUS.PENDING,
			localization = RED_RECORD_LOCALIZATION.LOCAL
		}
	) {
		super( src, owner, value, token, head );
		this.subordination = subordination;
		this.src = src;
		this.subscribers = new Set();
		this.status = status;
		this.localization = localization;
		this.registered = false;
	}
	
	register() {
		this.registered = true;
	}
	
	onRecordStatusUpdate(rec, status) {
		this.status = status;
	}
	
	on(subscriber) {
		this.subscribers.add(subscriber);
	}
	
	off(subscriber) {
		this.subscribers.delete(subscriber);
	}
	
	static get STATUS() {
		return RED_RECORD_STATUS;
	}
	
	static get SUBORDINATION() {
		return RED_RECORD_SUBORDINATION;
	}
	
	static get LOCALIZATION() {
		return RED_RECORD_LOCALIZATION;
	}
	
}