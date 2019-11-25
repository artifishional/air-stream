import {EndPoint} from "./end-point";
import getTTMP from "./get-ttmp";

const MAX_MSG_LIVE_TIME_MS = 7000;

export class StorableAC extends EndPoint {
	
	constructor(proJ = (_, data) => data) {
		super( proJ );
		this._queue = [];
		this.type = new.target.TYPES.PIPE;
	}
	
	get queue() {
		return this._queue;
	}
	
	registerSubscriber( connect, subscriber ) {
		super.registerSubscriber(connect, subscriber);
		subscriber( this.queue );
	}
	
	createEmitter() {
		if(!this._emitter) {
			this.queue.length = 0;
			this._emitter = (solid) => {
				this.queue.push(...solid);
				if(this.queue.length > 1) {
					this.queueNormalize();
				}
				[...this.connections.values()].map( subscriber => subscriber( solid ) );
			};
		}
		return this._emitter;
	}
	
	queueNormalize() {
		const currentTTMP = getTTMP();
		let firstActualMsgIndex = this.queue
			.findIndex( rec => rec.ttmp > currentTTMP - MAX_MSG_LIVE_TIME_MS );
		if(firstActualMsgIndex === this.queue.length - 1) {
			firstActualMsgIndex -- ;
		}
		if(firstActualMsgIndex > 0) {
			this.queue.splice( 0, firstActualMsgIndex + 1);
		}
		else if(firstActualMsgIndex === -1) {
			this.queue.splice( 0, this.queue.length - 1);
		}
	}
	
}