import Observable, {keyA} from '../observable/index.mjs'
import getTTMP from "./get-ttmp.mjs"



const EMPTY_OBJECT = Object.freeze({ empty: 'empty' });
const EMPTY_FN = () => EMPTY_OBJECT;
const FROM_OWNER_STREAM = Object.freeze({ fromOwnerStream: 'fromOwnerStream' });
let GLOBAL_CONNECTIONS_ID_COUNTER = 1;
let GLOBAL_REQUEST_ID_COUNTER = 1;
const STATIC_PROJECTS = {
	STRAIGHT: data => data,
	AIO: (...args) => args,
};

const KEY_SIGNALS = new Set(Observable.keys);

export class Stream2 {
	
	static isKeySignal(data) {
		return KEY_SIGNALS.has(data);
	}
	
	constructor(sourcestreams, project, ctx = null) {
		this.subscribers = [];
		/*<@debug>*/
		this._label = "";
		/*</@debug>*/
		this.project = project;
		this.ctx = ctx;
		this.sourcestreams = sourcestreams;
	}
	
	static fromevent(target, event) {
		return new Stream2( [], (e, controller) => {
			target.addEventListener( event, e );
			controller.todisconnect( () => target.removeEventListener( event, e ));
		});
	}
	
	static merge(sourcestreams, project) {
		return new Stream2( [], (e, controller) => {
			sourcestreams.map( stream => stream.connect( hook => {
				controller.todisconnect(hook);
				return e;
			} ) );
		});
	}

	controller( connection ) {
		return new Stream2( null,( e, controller ) => {
			this.connect(hook => {
				connection.connect( hook => {
					controller.to(hook);
					return EMPTY_FN;
				} );
				controller.to(hook);
				return e;
			} );
		} );
	}

	reduceF(state, project, init) {
		if(state instanceof Function) {
			init = project;
			project = state;
			state = FROM_OWNER_STREAM;
		}
		return new Reducer( this, project, state, init);
	}
	
	/*<@debug>*/
	label(label) {
		this._label = label;
		return this;
	}
	/*</@debug>*/

	configure({ slave = false, stmp = false } = {}) {
		return new Stream2(null, (e, controller) => {
			this.connect( hook => {
				controller.to(hook);
				return ( data, record ) => {
					e(data, { ...record, slave, stmp: -stmp });
				}
			});
		})
	}

	/**
	 * @param {Promise} source - Input source
	 * @param {Function} project - Mapper project function
	 * @returns {Stream2}
	 */
	static from(source, project) {
		if(source instanceof Promise) {
			return this.fromPromise(source, project);
		}
		throw new TypeError("Unsupported source type");
	}

	static fromPromise(source, project = STATIC_PROJECTS.STRAIGHT) {
		return new Stream2(null, (e, controller) => {
			source.then( data => {
				if(!controller.disconnected) {
					e(project(data));
				}
			} );
		});
	}

	/**
	 @example
	 stream2.with( [streamA, streamB], owner => (event, source, record) => {
			//источник определяется в момент коннекта
			//может быть временно неопределенным
			//к синхронному к своим ичтоникам потоку
			//нельзя динамически присоединять другие асинхронные источники
			//такая операция будет вызывать исключение
			owner.attach( stream[, customHandler ] );
			//используется общий обработчик, если явно не указан другой
			owner.detach( stream );
		} );
	 */
	static with(streams, handler, sync = true) {

	}

	store() {
		return new Reducer( null, null, this );
	}
	
	map(project) {
		return new Stream2(null, (e, ctr) => {
			this.connect( (hook) => {
				ctr.to(hook);
				return (data, record) => {
					if(isKeySignal(data)) {
						return e(data, record);
					}
					e(project(data), record);
				}
			});
		});
	}
	
	connect( connector ) {
		const controller = this.createController();
		const hook = (action = "disconnect", data = null) => {
			/*<@debug>*/
			if(typeof action !== "string") {
				throw new TypeError("Action must be a string only");
			}
			/*</@debug>*/
			if(action === "disconnect") {
				const removed = this.subscribers.indexOf(subscriber);
				/*<@debug>*/
				if(removed < 0) throw `
					${this._label}: Attempt to delete an subscriber out of the container
				`;
				/*</@debug>*/
				this.subscribers.splice(removed, 1);
				this._deactivate( subscriber, controller );
			}
			else {
				controller.send(action, data);
			}
		};
		const subscriber = connector(hook);
		this.subscribers.push(subscriber);
		this._activate( subscriber, controller );
	}
	
	on( subscriber ) {
		console.warn("This method deprecated now, pls use .connect() instead");
		this.subscribers.push(subscriber);
		const controller = this._activate( subscriber );
		return (action = "disconnect", data = null) => {
			if(action === "disconnect") {
				const removed = this.subscribers.indexOf(subscriber);
				/*<@debug>*/
				if(removed < 0) throw `
					${this._label}: Attempt to delete an subscriber out of the container
				`;
				/*</@debug>*/
				this.subscribers.splice(removed, 1);
				this._deactivate( subscriber, controller );
			}
			else {
				controller.send(action, data);
			}
		}
	}

	at(subscriber) {
		return this.on( (data, record) => {
			if(isKeySignal(data)) {
				return ;
			}
			subscriber( data, record );
		} );
	}
	
	filter(project) {
		return new Stream2(null, (e, controller) => {
			this.connect( hook => {
				controller.to(hook);
				return (data, record) => {
					if(isKeySignal(data)) {
						return e(data, record);
					}
					const res = project(data);
					res && e(data, record);
				}
			} );
		});
	}
	
	distinct(equal) {
		return new Stream2(null, (e, controller) => {
			let state = EMPTY_OBJECT;
			this.connect( hook => {
				controller.to( hook );
				return (data, record) => {
					if(isKeySignal(data)) {
						if(data === keyA) {
							state = EMPTY_OBJECT;
						}
						return e(data, record);
					}
					else if(state === EMPTY_OBJECT) {
						state = data;
						e(data, record);
					}
					else if(!equal(state, data)) {
						state = data;
						e(data, record);
					}
				}
			} );
		});
	}
	
	_activate( subscriber, controller = this.createController() ) {
		const emitter = this.createEmitter( subscriber );
		this.project.call(this.ctx, emitter, controller);
		return controller;
	}

	_deactivate( subscriber, controller ) {
		controller.send("disconnect", null);
	}
	
	createEmitter( subscriber ) {
		return (data, record = { ttmp: getTTMP() }) => {
			/*<@debug>*/
			if(!this.subscribers.includes(subscriber)) {
				throw "More unused stream continues to emit data";
			}
			/*</@debug>*/
			
			//todo temporary cross ver support
			/*if(isKeySignal(data)) {
				return ;
			}*/
			
			subscriber(data, record );
		};
	}
	
	createController(  ) {
		return new Controller( this );
	}
	
	static sync (sourcestreams, equal, poject = STATIC_PROJECTS.AIO) {
		return this
			.combine(sourcestreams)
			.withHandler((e, streams) => {
				if (streams.length > 1) {
					if (streams.every(stream => equal(streams[0], stream))) {
						e(poject(...streams));
					}
				} else if (streams.length > 0) {
					if (equal(streams[0], streams[0])) {
						e(poject(...streams));
					}
				} else {
					e(poject());
				}
			});
	}
	
	withHandler (handler) {
		return new Stream2(null, (e, controller) =>
			this.connect(hook => {
				controller.to(hook);
				return (evt, record) => {
					if (Observable.keys.includes(evt)) {
						return e(evt, record);
					}
					const _e = (evt, _record) => e(evt, _record || record);
					return handler(_e, evt);
				}
			})
		);
	}
	
	static combine(sourcestreams, project = (...streams) => streams) {
		if(!sourcestreams.length) {
			return new Stream2( null, (e) => {
				e(project());
			} );
		}
		return new Stream2( sourcestreams, (e, controller) => {
			const sourcestreamsstate = new Array(sourcestreams.length).fill( EMPTY_OBJECT );
			sourcestreams.map( (stream, i) => {
				return stream.connect( hook => {
					controller.to(hook);
					return (data, record) => {
						if(Observable.keys.includes(data)) {
							return e( data, record );
						}
						sourcestreamsstate[i] = data;
						if(!sourcestreamsstate.includes(EMPTY_OBJECT)) {
							e(project(...sourcestreamsstate), record);
						}
					}
				} );
			} );
		} );
	}
	
	withlatest(sourcestreams = [], project = STATIC_PROJECTS.AIO) {
		return new Stream2( null, (e, controller) => {
			let slave = false;
			const sourcestreamsstate = new Array(sourcestreams.length).fill( EMPTY_OBJECT );
			sourcestreams.map( (stream, i) => {
				stream.connect((hook) => {
					controller.todisconnect(hook);
					return (data, record) => {
						if (record.slave) slave = true;
						if (isKeySignal(data)) {
							return e(data, {...record, slave});
						}
						sourcestreamsstate[i] = data;
					}
				});
			});
			this.connect( hook => {
				controller.to(hook);
				return (data, record) => {
					if(isKeySignal(data)) {
						return e( data, record );
					}
					if(!sourcestreamsstate.includes(EMPTY_OBJECT)) {
						e(project(data, ...sourcestreamsstate), { ...record, slave });
					}
				}
			} );
		} );
	}
	
	/*<@debug>*/
	log() {
		return new Stream2( this, (e, controller) => {
			this.connect(hook => {
				controller.to( hook );
				return (data, record) => {
					console.log(data);
					e(data, record);
				}
			});
		});
	}
	/*</@debug>*/

	/**
	 * Кеширует соединение линии потока, чтобы новые стримы не создавались
	 */
	endpoint() {
		return new EndPoint( null, (e, controller) => {
			this.connect(hook => {
				controller.to(hook);
				return e;
			});
		} );
	}
	
	/**
	 * @param {fromRemoteService} remoteservicecontroller - Remoute service controller connection
	 * @param {Object} stream - Stream name from server
	 */
	static fromRemoteService( remoteservicecontroller, stream ) {
		return new Stream2(null, (e, controller) => {
			const connection = { id: GLOBAL_CONNECTIONS_ID_COUNTER ++ };
			remoteservicecontroller.connect( (hook) => {
				controller.tocommand((request, data) => {
					if(request === "request") {
						hook("command", { data, connection });
					}
				});
				controller.todisconnect(hook);
				return ({ event, data, connection: { id } }, record) => {
					if(event === "remote-service-ready") {
						hook("subscribe", { stream, connection });
					}
					else if(event === "reinitial-state" && connection.id === id ) {
						e(data, { ...record, grid: 0 });
					}
					else if(event === "data" && connection.id === id ) {
						e(data, { ...record, grid: -1 });
					}
					else if(event === "result" && connection.id === id ) {
						e(data, { ...record, grid: -1 });
					}
				}
			});
		} );
	}
	
	static ups() {
		const factor = UPS.ups / 1000;
		return new Stream2( [], (e, controller) => {
			let globalCounter = 0;
			const startttmp = getTTMP();
			const sid = setInterval(() => {
				const current = getTTMP();
				const count = (current - startttmp) * factor - globalCounter|0;
				if(count > 10000) throw "Uncounted err";
				for (let i = 0; i < count; i++) {
					globalCounter++;
					e(globalCounter, { ttmp: startttmp + globalCounter * factor|0 });
				}
			}, 500 / UPS.ups);
			controller.todisconnect( () => clearInterval(sid) );
		} );
	}

	static x(sourcestreams, project = states => states, actionHandler) {
		return new Stream2(Object.values(sourcestreams), (e, controller) => {
			const sourcestreamsstate =
				Object.keys(sourcestreams).reduce((acc, key) => ({...acc, key: EMPTY_OBJECT}), {});
			let _state;
			let _privateState;
			const connectors = Object.fromEntries(Object.entries(sourcestreams)
				.map(([key, stream]) => [key, stream.on((data, record) => {
					sourcestreamsstate[key] = data;
					if (!Object.values(sourcestreamsstate).includes(EMPTY_OBJECT)) {
						const [state, action, privateState] = project(sourcestreamsstate, key, data.action);
						_state = state;
						_privateState = privateState;
						action && e([state, action], record);
					}
				})]));
			if (actionHandler) {
				controller.to(({action, ...data}) => {
					Object.entries(actionHandler(action, data, _state)).forEach(([index, data]) => {
						if (index === 'controller') {
							_state = data;
							e(_state);
						} else {
							connectors[index](data);
						}
					});
				});
			} else {
				controller.to(...connectors);
			}
		});
	}
}

export const stream2 = (...args) => new Stream2(...args);
//static props recalc to stream2
Object.getOwnPropertyNames(Stream2)
	.filter(prop => typeof Stream2[prop] === "function")
	.map( prop => stream2[prop] = Stream2[prop] );

export class RemouteService extends Stream2 {

	/**
	 * @param {host, port} websocketconnection settings
	 */
	static fromWebSocketConnection ({host, port}) {
		let websocketconnection = null;
		let remouteserviceconnectionstatus = null;
		const STMPSuncData = { remoute: -1, connected: -1, current: -1 };
		return new RemouteService(null, (e, controller) => {
			if(!websocketconnection) {
				websocketconnection = new WebSocket(`ws://${host}:${port}`);
				UPS.subscribe( stmp => STMPSuncData.current = stmp );
			}
			function onsocketmessagehandler({ data: raw }) {
				const msg = JSON.parse(raw);
				if(msg.event === "remote-service-ready") {
					STMPSuncData.remoute = msg.stmp;
					STMPSuncData.connected = UPS.current;
					remouteserviceconnectionstatus = "ready";
					e( msg );
				}
				else if( msg.event === "data") {
					e( msg );
				}
			}
			function onsocketopendhandler() {
				controller.tocommand( (request, data) => {
					if(request === "subscribe") {
						websocketconnection.send( JSON.stringify({ ...data, request }) );
					}
					if(request === "command") {
						const stmp = STMPSuncData.remoute - STMPSuncData.connected - data.stmp;
						websocketconnection.send( JSON.stringify({ ...data, stmp, request })  );
					}
				} );
			}
			if(websocketconnection.readyState === WebSocket.OPEN) {
				onsocketopendhandler();
			}
			else {
				websocketconnection.addEventListener("open", onsocketopendhandler);
				controller.todisconnect( () => {
					socket.removeEventListener("open", onsocketopendhandler);
				} );
			}
			if(remouteserviceconnectionstatus === "ready") {
				e( { event: "remote-service-ready", connection: { id: -1 }, data: null } );
			}
			websocketconnection.addEventListener("message", onsocketmessagehandler);
			controller.todisconnect( () => {
				websocketconnection.removeEventListener("message", onsocketmessagehandler);
			} );
		} );
	}

}

Stream2.FROM_OWNER_STREAM = FROM_OWNER_STREAM;

export class Controller {
	
	constructor(src) {
		this.src = src;
		this.disconnected = false;
		this._todisconnect = [];
		this._tocommand = [];
	}
	
	todisconnect(...connectors) {
		this._todisconnect.push(...connectors);
	}
	
	to(...connectors) {
		this._todisconnect.push(...connectors);
		this._tocommand.push(...connectors);
	}
	
	tocommand( ...connectors ) {
		this._tocommand.push( ...connectors );
	}

	send( action, data ) {
		/*<@debug>*/
		if(this.disconnected) {
			throw `${this.src._label}: This controller is already diconnected`;
		}
		/*</@debug>*/
		if(action !== "disconnect") {
			this._tocommand.map( connector => connector(action, data) );
		}
		else {
			this.disconnected = true;
			this._todisconnect.map( connector => connector(action, data) );
		}
	}

}

export class EndPoint extends Stream2 {

	createEmitter( subscriber ) {
		if(!this.emitter) {
			this.emitter = (data, record = { ttmp: getTTMP() }) => {
				this.subscribers.map( subscriber => subscriber(data, record) );
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

	_activate() {
		if(!this._activated) {
			this._activated = super._activate();
		}
		return this._activated;
	}

	_deactivate(subscriber, controller) {
		if(this._activated && !this.subscribers.length) {
			super._deactivate( subscriber, controller );
			this._activated = null;
		}
	}

}

export class Reducer extends Stream2 {

	/**
	 * @param sourcestreams {Stream2|null} Operational stream
	 * @param project {Function}
	 * @param state {Object|Stream2} Initial state (from static or stream)
	 * @param init {Function} Initial state mapper
	 */
	constructor(sourcestreams, project = (_, data) => data, _state = EMPTY_OBJECT, init = null) {
		const cst = _state;
		const type = _state instanceof Stream2 ? 1/*"slave"*/ : 0/*"internal"*/;
		super(sourcestreams, (e, controller) => {
			//initial state reused
			let state = _state;
			const sked = [];
			const STMPSuncData = { current: -1 };
			UPS.subscribe( stmp => {
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
			} );
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
		this._activated = null;
		this._queue = [];
		this.emitter = null;
		this.__controller = null;
	}
	
	get queue() {
		return this._queue;
	}
	
	createEmitter( subscriber ) {
		if(!this.emitter) {
			this.emitter = (data, record = { ttmp: getTTMP() }) => {
				this.queue.push( [ data, record ] );
				if(this.queue.length > 1) {
					this._normalizeQueue();
				}
				this.subscribers.map( subscriber => subscriber(data, record) );
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
	
	_activate() {
		if(!this._activated) {
			this._activated = super._activate();
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
	
	connect( connector ) {
		super.connect( (hook) => {
			const subscriber = connector(hook);
			this.queue.map( ([data, record]) => {
				subscriber(data, record);
			});
			return subscriber;
		} );
	}
	
	on( subscriber ) {
		this.queue.map( ([data, record]) =>
			subscriber => subscriber(data, record)
		);
		return super.on( subscriber );
	}

}

Stream2.KEY_SIGNALS = KEY_SIGNALS;
const isKeySignal = Stream2.isKeySignal;
const MAX_MSG_LIVE_TIME_MS = 7000;

const UPS = new class {

	constructor() {
		this.subscribers = [];
		//todo async set at UPS state value
		//const factor = this.ups / 1000;
		let globalCounter = 0;
		const startttmp = getTTMP();
		const sid = setInterval(() => {
			const factor = this.ups / 1000;
			const current = getTTMP();
			const count = (current - startttmp) * factor - globalCounter|0;
			for (let i = 0; i < count; i++) {
				globalCounter++;
				this.tick(globalCounter, startttmp + globalCounter * factor|0);
			}
		}, 500 / this.ups);
	}

	set(ups) {
		this.ups = ups;
	}

	tick(stmp, ttmp) {
		this.subscribers.map( subscriber => subscriber(stmp, ttmp) );
	}
	
	subscribe( subscriber ) {
		this.subscribers.push( subscriber );
	}

	unsubscribe( subscriber ) {
		const removed = this.subscribers.indexOf(subscriber);
		/*<@debug>*/
		if(removed < 0) throw `Attempt to delete an subscriber out of the container`;
		/*</@debug>*/
		this.subscribers.splice(removed, 1);
	}

};

stream2.UPS = UPS;