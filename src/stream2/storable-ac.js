import {Stream2} from "./index";
import getTTMP from "./get-ttmp";

const MAX_MSG_LIVE_TIME_MS = 7000;

/**
 * every RemoteReducer creates your
 */

export class StorableAC extends Stream2 {
	
	constructor(proJ = (_, data) => data) {
		super( proJ );
		this.connectionParams = null;
		this.subscribers = new Map();
		this._activated = null;
		this._queue = [];
		this.emitter = null;
		this.__controller = null;
	}
	
	get queue() {
		return this._queue;
	}
	
	createEmitter( ) {
		if(!this.emitter) {
			this.emitter = (solid) => {
				this.queue.push( ...solid );
				if(this.queue.length > 1) {
					this.queueNormalize();
				}
				[...this.subscribers.values()].map( subscriber => subscriber( solid ) );
			};
		}
		return this.emitter;
	}
	
	createController( ) {
		if(!this.__controller) {
			this.__controller = super.createController();
		}
		return this.__controller;
	}
	
	_activate( controller, connector, hook ) {
		this.subscribers.set(connector, null);
		if(!this.connectionParams) {
			if(!this._activated) {
				this._activated = super._activate(controller, (evtChWSpS, hook) => {
					this.connectionParams = { evtChWSpS };
					[...this.subscribers.keys()].map( connector => {
						const subscriber = connector( evtChWSpS, hook );
						this.subscribers.set(connector, subscriber);
						subscriber( this.queue );
					} );
					return this.createEmitter();
				}, hook );
			}
		}
		else {
			const subscriber = connector( this.connectionParams.evtChWSpS, hook );
			this.subscribers.set(connector, subscriber);
			subscriber( this.queue );
		}
		return this._activated;
	}
	
	_deactivate(connector, controller) {
		this.subscribers.delete(connector);
		if(this._activated && !this.subscribers.size) {
			super._deactivate( connector, controller );
			this._activated = null;
			this.__controller = null;
		}
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