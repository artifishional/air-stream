import {Stream2} from "./index";
import getTTMP from "./get-ttmp";
import {REQUEST} from "./signals";
import {Record, WSpring} from "./well-spring";
import {Request} from "./request";
import {StorableIO} from "./storable-io";

const STD_REMOTE_EVENT_DELAY = 3;

export class RmtReducerRec extends Record {
	
	constructor(value, origin, rq) {
		super(value, origin);
		this.ttmp += STD_REMOTE_EVENT_DELAY;
		this.request = rq;
	}

	static from( rec, rq ) {
		return new RmtReducerRec(rec.value, rec, rq);
	}

}

export class RemoteReducerView extends StorableIO {
	
	/**
	 * У редьюсера всегда есть начальное состояние, но
	 * редьюсер может быть локальным и удаленным,
	 * у удаленного редьюсера состояние не доступно синхронно (втч и ресурс)
	 *
	 * Это также означает и то, что общая реализация редьюсера
	 * не предуматривает отдельного потока для связывания
	 * удаленного и локального состояний
	 *
	 * RemoteReducer это отражение редьюсера общего вида для клиента
	 * Переход от Reducer к RemoteReducer превращает тип канала в controller
	 *
	 * @param evtCh {Stream2} Operational chanel
	 * @param proJ {Function}
	 * @param evtChRmt {Stream2} Remote state sync chanel
	 * @param evtChRmtMap Remote state sync chanel mapper function
	 */
	constructor(evtCh, proJ = (_, data) => data, evtChRmt, evtChRmtMap = null) {
		super( ( connect, control ) => {
			evtChRmt.connect( (_, evtChRmtHook) => {
				const evtChRmtWSpS = [ new WSpring() ];
				control.todisconnect( evtChRmtHook );
				let state;
				return (evtChRmtSoliD, evtChRmtRec) => {
					evtCh.connect( (evtChWSpS, evtChHook) => {
						control.todisconnect( evtChHook );
						const feeder = connect( [...evtChRmtWSpS, ...evtChWSpS] );
						state = evtChRmtMap ? evtChRmtMap(evtChRmtSoliD) : evtChRmtSoliD;
						feeder( [ evtChRmtWSpS[0].rec(state) ] );
						return (evtChSoliD) => {
							feeder(evtChSoliD.map( evtChRec => {
								state = proJ( state, evtChRec.value, evtChRec );
								const rQ = new Request(evtChRec);
								const rec = RmtReducerRec.from( evtChRec, rQ );
								evtChRmtHook(REQUEST, rQ);
								return rec;
							} ));
						}
					});
				}
			})
		});
		this.connectors = [];
		this._activated = null;
		this._queue = [];
		this.emitter = null;
		this.__controller = null;
	}
	
	get queue() {
		return this._queue;
	}
	
	createEmitter( subscriber ) {
		this.subscribers.push(subscriber);
		if(!this.emitter) {
			this.emitter = (data, record = { ttmp: getTTMP() }, sources) => {
				if(!this.__connection) {
					this.__connection = sources;
					this.subscribers.push(
						...this.connectors.map( ([connector, hook]) => connector(hook, sources) )
					);
				}
				this.queue.push( [ data, record ] );
				if(this.queue.length > 1) {
					this._normalizeQueue();
				}
				this.subscribers.map( subscriber => subscriber(data, record) );
			};
		}
		if(this.__connection) {
			if(this.queue.length) {
				this.queue.map( evt => subscriber(...evt) );
			}
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
		if(!this._activated) {
			this._activated = super._activate(controller, connector, hook );
		}
		return this._activated;
	}
	
	_deactivate(subscriber, controller) {
		if(this._activated && !this.subscribers.length) {
			super._deactivate( subscriber, controller );
			this._activated = null;
			this.__controller = null;
		}
	}
	
	_normalizeQueue() {
		const currentTTMP = getTTMP();
		let firstActualMsgIndex = this.queue
			.findIndex( ( [, {ttmp}]) => ttmp > currentTTMP - MAX_MSG_LIVE_TIME_MS );
		if(firstActualMsgIndex === this.queue.length - 1) {
			firstActualMsgIndex -- ;
		}
		if(firstActualMsgIndex > 0) {
			this.queue.splice( 0, firstActualMsgIndex + 1);
		}
		else {
			this.queue.splice( 0, this.queue.length - 1);
		}
	}
	/*
	connect( connector ) {
		super.connect( (hook) => {
			const subscriber = connector(hook);
			this.queue.map( ([data, record]) => {
				subscriber(data, record);
			});
			return subscriber;
		} );
	}*/
	
}