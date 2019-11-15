import getTTMP from "./get-ttmp";
import {Stream2} from "./index";
import {EMPTY} from "./signals";

export class RemoteReducerView extends Stream2 {
	
	/**
	 * @param sourcestream {Stream2|null} Operational stream
	 * @param project {Function}
	 * @param _state {Object|Stream2} Initial state (from static or stream)
	 * @param init {Function} Initial state mapper
	 */
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
	 * @param spring
	 * @param proJ
	 * @param _state
	 * @param init
	 */
	constructor(spring, proJ = (_, data) => data, _state = EMPTY_OBJECT, init = null) {
		const cst = _state;
		const type = _state instanceof Stream2 ? 1/*"slave"*/ : 0/*"internal"*/;
		super((connector, controller) => {
			
			
			function handler(sources) {
			
			}
			
			if(sourcestream) {
				sourcestream.connect( (sources, hook) => {
					
					handler();
					
				} );
			}
			
			debugger;
			
			const e = connector();
			
			
			//initial state reused
			let state = _state;
			const sked = [];
			const STMPSuncData = { current: -1 };
			/*UPS.subscribe( stmp => {
				STMPSuncData.current = stmp;
				const events = sked.filter( ([_, record]) => record.stmp === stmp );
				if(events.length) {
					events.map( evt => {
						sked.splice(sked.indexOf(evt), 1);
						const newstate = project(state, evt[0]);
						if(newstate !== undefined) {
							state = newstate;
							e( state, evt[1] );
						}
					} );
				}
			} );*/
			let srvRequesterHook = null;
			
			if(state !== EMPTY_OBJECT && state !== FROM_OWNER_STREAM) {
				if(type === 1) {
					state.connect( hook => {
						controller.tocommand( (request, data) => {
							//todo need req cb
							if(request === "request") {
								hook(request, data);
							}
						} );
						controller.todisconnect( srvRequesterHook = hook );
						return (data) => {
							e( state = init ? init(data) : data );
						}
					} );
				}
				else {
					state = init ? init(state) : state;
					e( state, { ttmp: getTTMP() } );
				}
			}
			if(sourcestreams) {
				sourcestreams.connect( hook => {
					controller.to(hook);
					return (data, { stmp, ...record } ) => {
						if(state === FROM_OWNER_STREAM) {
							state = init ? init(data[0]) : data[0];
							return e( [ state, {} ], { ttmp: getTTMP() } );
						}
						const needConfirmation = type === 1 && record.slave;
						if(stmp) {
							const grid = type === 1 ? GLOBAL_REQUEST_ID_COUNTER ++ : -1;
							record = { stmp: STMPSuncData.current + 4, ...record };
							if(needConfirmation) {
								record = { ...record, slave: false, grid, confirmed: !type };
							}
							else {
								record = { ...record, grid, confirmed: !type };
							}
							sked.push([data, record]);
							if(needConfirmation) {
								srvRequesterHook("request", { grid, data, record });
							}
						}
						else {
							
							//todo temporary solution
							if(state instanceof Stream2) {
								return;
							}
							
							const newstate = project(state, data);
							if(newstate !== undefined) {
								state = newstate;
								const grid = type === 1 ? GLOBAL_REQUEST_ID_COUNTER ++ : -1;
								if(needConfirmation) {
									record = { ...record, slave: false, grid, confirmed: !type };
								}
								else {
									record = { ...record, grid, confirmed: !type };
								}
								e( state, record );
								if(needConfirmation) {
									srvRequesterHook("request", { grid, data, record });
								}
							}
						}
					}
				} );
			}
			if(!sourcestreams && !state) {
				/*<@debug>*/
				console.warn("This stream is always empty.");
				/*</@debug>*/
			}
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

export class LocalReducer extends Stream2 {
	
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
	 * @param eventCh {Stream2} Operational chanel
	 * @param proJ {Function}
	 * @param remoteCh {Stream2} Remote state sync chanel
	 * @param remoteChMapper Remote state sync chanel mapper function
	 */
	constructor(eventCh, proJ = (_, data) => data, remoteCh, remoteChMapper = null) {
		super( ( connect, control ) => {
			remoteCh.connect( (remoteChWellspring, remoteChHook) => {
				control.todisconnect( remoteChHook );
				let state;
				return (remoteChData, remoteChRec) => {
					state = remoteChMapper ? remoteChMapper(remoteChData) : remoteChData;
					eventCh.connect( (eventChWellspring, eventChHook) => {
						control.todisconnect( eventChHook );
						const feeder = connect( [...remoteChWellspring, ...eventChWellspring] );
						feeder( state );
						return (eventChData, eventChRec) => {
							state = proJ( state, eventChData, eventChRec );
							feeder( state, eventChRec );
						}
					});
				}
			})
		});
		
		
		const cst = _state;
		const type = _state instanceof Stream2 ? 1/*"slave"*/ : 0/*"internal"*/;
		super((connector, controller) => {
			
			
			function handler(sources) {
			
			}
			
			if(sourcestream) {
				sourcestream.connect( (sources, hook) => {
					
					handler();
					
				} );
			}
			
			debugger;
			
			const e = connector();
			
			
			//initial state reused
			let state = _state;
			const sked = [];
			const STMPSuncData = { current: -1 };
			/*UPS.subscribe( stmp => {
				STMPSuncData.current = stmp;
				const events = sked.filter( ([_, record]) => record.stmp === stmp );
				if(events.length) {
					events.map( evt => {
						sked.splice(sked.indexOf(evt), 1);
						const newstate = project(state, evt[0]);
						if(newstate !== undefined) {
							state = newstate;
							e( state, evt[1] );
						}
					} );
				}
			} );*/
			let srvRequesterHook = null;
			
			if(state !== EMPTY_OBJECT && state !== FROM_OWNER_STREAM) {
				if(type === 1) {
					state.connect( hook => {
						controller.tocommand( (request, data) => {
							//todo need req cb
							if(request === "request") {
								hook(request, data);
							}
						} );
						controller.todisconnect( srvRequesterHook = hook );
						return (data) => {
							e( state = init ? init(data) : data );
						}
					} );
				}
				else {
					state = init ? init(state) : state;
					e( state, { ttmp: getTTMP() } );
				}
			}
			if(sourcestreams) {
				sourcestreams.connect( hook => {
					controller.to(hook);
					return (data, { stmp, ...record } ) => {
						if(state === FROM_OWNER_STREAM) {
							state = init ? init(data[0]) : data[0];
							return e( [ state, {} ], { ttmp: getTTMP() } );
						}
						const needConfirmation = type === 1 && record.slave;
						if(stmp) {
							const grid = type === 1 ? GLOBAL_REQUEST_ID_COUNTER ++ : -1;
							record = { stmp: STMPSuncData.current + 4, ...record };
							if(needConfirmation) {
								record = { ...record, slave: false, grid, confirmed: !type };
							}
							else {
								record = { ...record, grid, confirmed: !type };
							}
							sked.push([data, record]);
							if(needConfirmation) {
								srvRequesterHook("request", { grid, data, record });
							}
						}
						else {
							
							//todo temporary solution
							if(state instanceof Stream2) {
								return;
							}
							
							const newstate = project(state, data);
							if(newstate !== undefined) {
								state = newstate;
								const grid = type === 1 ? GLOBAL_REQUEST_ID_COUNTER ++ : -1;
								if(needConfirmation) {
									record = { ...record, slave: false, grid, confirmed: !type };
								}
								else {
									record = { ...record, grid, confirmed: !type };
								}
								e( state, record );
								if(needConfirmation) {
									srvRequesterHook("request", { grid, data, record });
								}
							}
						}
					}
				} );
			}
			if(!sourcestreams && !state) {
				/*<@debug>*/
				console.warn("This stream is always empty.");
				/*</@debug>*/
			}
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