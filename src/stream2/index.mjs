import Observable, {keyA} from '../observable/index.mjs'
import getTTMP from "./get-ttmp.mjs"
import {CONNECT, EMPTY} from "./signals";


const EMPTY_OBJECT = Object.freeze({ empty: 'empty' });
const EMPTY_FN = () => EMPTY_OBJECT;
const FROM_OWNER_STREAM = Object.freeze({ fromOwnerStream: 'fromOwnerStream' });
let GLOBAL_CONNECTIONS_ID_COUNTER = 1;
let GLOBAL_REQUEST_ID_COUNTER = 1;
const STATIC_PROJECTS = {
	STRAIGHT: data => data,
	AIO: (...args) => args,
};
const USER_EVENT = {};

const KEY_SIGNALS = new Set(Observable.keys);

export class Stream2 {
	
	static isKeySignal(data) {
		return KEY_SIGNALS.has(data);
	}
	
	constructor(project, ctx = null) {
		this.subscribers = [];
		/*<@debug>*/
		this._label = "";
		/*</@debug>*/
		this.project = project;
		this.ctx = ctx;
	}
	
	static fromevent(target, event) {
		return new Stream2( [], (e, controller) => {
			e(CONNECT, USER_EVENT);
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
	static with(streams, handlerProject, sync = true) {
		
		class Handler {
			
			constructor( owner, ctr, emt, handler, streams = [] ) {
				this.streams = new Map();
				this.handler = handler;
				this.owner = owner;
				this.emt = emt;
				this.neighbourStreamsBySource = new Map();
				this.ctr = ctr;
				streams.map( stream => this.attach(stream, handler) );
			}
			
			handleEvent(e, rec, stream) {
				const { neighbours: { state, index, streams } } = this.streams.get(stream);
				
				/*<@debug>*/
				if(!state[index]) throw `
					${this.owner._label}: Attempt to rewrite existing state in neighbours queue
				`;
				/*</@debug>*/
				
				state[index] = [e, rec];
				if(state.every(Boolean)) {
					const res = streams.reduce( (acc, stream, i) => {
						if(state[i][0] !== EMPTY) {
							const { handler } = this.streams.get( stream );
							const res = handler( state[i][0], stream, state[i][1] );
							return res !== undefined ? res : acc;
						}
						return acc;
					}, undefined );
					if(res !== undefined) {
						this.emt( res, rec );
					}
					else {
						this.emt( EMPTY, rec );
					}
					state.fill(null);
				}
			}
			
			attach( stream, handler = this.handler ) {
				const streamRelatedData = {
					handler,
					stream,
					sources: [],
					neighbours: [],
				};
				this.streams.set(stream, streamRelatedData);
				stream.connect( (hook, sources) => {
					streamRelatedData.sources = sources;
					let neighbourStreams = this.neighbourStreamsBySource.get(sources);
					if(neighbourStreams) {
						this.neighbourStreamsBySource.set(source, neighbourStreams = []);
					}
					neighbourStreams.push(streamRelatedData);
					this.ctr.to( hook );
					return (e, rec) => {
						this.handleEvent(e, rec, stream);
					}
				} );
				this.streams.push( stream );
				return this;
			}
			
			detach( stream ) {
				//unsubscribe
				//clear neighbour queue cell
				//clear neighbour state queue cell
				this.streams.delete(stream);
				return this;
			}
			
		}
		
		return new Stream2((emt, ctr) => {
			const target = new Handler( handlerProject );
		});
	}

	store() {
		return new Reducer( null, null, this );
	}
	
	map(project) {
		return new Stream2((connector, controller) => {
			this.connect( (evtStreamsSRC, hook) => {
				controller.to(hook);
				const e = connector( evtStreamsSRC );
				return (data, record) => {
					if(isKeySignal(data)) {
						return e(data, record);
					}
					e(project(data), record);
				}
			});
		});
	}
	
	filter(project) {
		return new Stream2((connector, controller) => {
			this.connect( (evtStreamsSRC, hook) => {
				controller.to(hook);
				const e = connector( evtStreamsSRC );
				return (data, record) => {
					if (isKeySignal(data)) {
						return e(data, record);
					}
					const res = project(data);
					res && e(data, record);
				}
			} );
		});
	}
	
	/*<@debug>*/
	log() {
		return new Stream2( (connector, controller) => {
			this.connect((evtStreamsSRC, hook) => {
				controller.to( hook );
				const e = connector( evtStreamsSRC );
				return (data, record) => {
					console.log(data);
					e(data, record);
				}
			});
		});
	}
	/*</@debug>*/
	
	connect( connector = () => () => {} ) {
		const controller = this.createController();
		const hook = (action = "disconnect", data = null) => {
			/*<@debug>*/
			if(typeof action !== "string") {
				throw new TypeError("Action must be a string only");
			}
			/*</@debug>*/
			if(action === "disconnect") {
				this._deactivate( connector, controller );
			}
			else {
				controller.send(action, data);
			}
		};
		//const subscriber = connector(hook);
		//this.subscribers.push(subscriber);
		this._activate( controller, connector, hook );
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
	
	_activate( controller = this.createController(), connector, hook ) {
		this.project.call(this.ctx, (evtStreamsSRC = [this]) => {
			//when projectable stream connecting rdy
			const connected = connector( evtStreamsSRC, hook );
			return this.createEmitter( connected );
		}, controller);
		return controller;
	}

	_deactivate( subscriber, controller ) {
		controller.send("disconnect", null);
	}
	
	createEmitter( subscriber ) {
		this.subscribers.push(subscriber);
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
	 * @param sourcestream {Stream2|null} Operational stream
	 * @param project {Function}
	 * @param _state {Object|Stream2} Initial state (from static or stream)
	 * @param init {Function} Initial state mapper
	 */
	constructor(sourcestream, project = (_, data) => data, _state = EMPTY_OBJECT, init = null) {
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

Stream2.KEY_SIGNALS = KEY_SIGNALS;
const isKeySignal = Stream2.isKeySignal;
const MAX_MSG_LIVE_TIME_MS = 7000;

const UPS = new class {

	constructor() {
		this.subscribers = [];
		this.sid = -1;
	}

	set(ups) {
		this.ups = ups;
	}

	tick(stmp, ttmp) {
		this.subscribers.map( subscriber => subscriber(stmp, ttmp) );
	}
	
	subscribe( subscriber ) {
		if(this.sid === -1) {
			//todo async set at UPS state value
			//const factor = this.ups / 1000;
			let globalCounter = 0;
			const startttmp = getTTMP();
			this.sid = setInterval(() => {
				const factor = this.ups / 1000;
				const current = getTTMP();
				const count = (current - startttmp) * factor - globalCounter|0;
				for (let i = 0; i < count; i++) {
					globalCounter++;
					this.tick(globalCounter, startttmp + globalCounter * factor|0);
				}
			}, 500 / this.ups);
		}
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