import {Stream2} from "./index";


export class EndPointAC extends Stream2 {
	
	constructor(proJ = (_, data) => data) {
		super( proJ );
		this.connectionParams = null;
		this._activated = false;
		this._emitter = null;
		this.__controller = null;
		this.curFrameCachedRecord = null;
	}

	createEmitter() {
		if(!this._emitter) {
			this._emitter = (rec) => {
				this.curFrameCachedRecord = rec;
				[...this.connections.values()].map( subscriber => subscriber( rec ) );
			};
		}
		return this._emitter;
	}
	
	createController( ) {
		if(!this.__controller) {
			this.__controller = super.createController();
		}
		return this.__controller;
	}
	
	_activate( control, connect, hook ) {
		if(!this.connectionParams) {
			if(!this._activated) {
				this._activated = true;
				this.project.call(this.ctx, (evtChWSpS, own = this) => {
					this.connectionParams = { evtChWSpS };
					[...this.connections.keys()].map( connect => {
						this.startConnectionToSlave(connect, evtChWSpS, own, hook);
					} );
					return this.createEmitter();
				}, control);
			}
		}
		else {
			this.startConnectionToSlave(connect, this.connectionParams.evtChWSpS, this, hook);
		}
	}
	
	_deactivate(connector, controller) {
		this.connections.delete(connector);
		if(this._activated && !this.connections.size) {
			this.connectionParams = null;
			this._activated = false;
			this.__controller = null;
			controller.send("disconnect", null);
		}
	}
	
}