import Observable, {keyA} from '../observable/index.mjs'
import getTTMP from "./get-ttmp.mjs"

const EMPTY_OBJECT = Object.freeze({ empty: 'empty' });
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
		this.project = project;
		this.ctx = ctx;
		this.sourcestreams = sourcestreams;
		this.controller = this.createController();
	}
	
	static fromevent(target, event) {
		return new Stream2( [], (e, controller) => {
			target.addEventListener( event, e );
			controller.todisconnect( () => target.removeEventListener( event, e ));
		});
	}
	
	static merge(sourcestreams, project) {
		return new Stream2( [], (e, controller) => {
			controller.todisconnect(...sourcestreams.map( stream => stream.on( e ) ));
		});
	}
	
	reduceF(state, project) {
		return new Reducer( this, project, state);
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

	store() {
		return new Reducer( null, null, this );
	}
	
	on( subscriber ) {
		this.subscribers.push(subscriber);
		this._activate( subscriber );
		return ({ disconnect = false, ...args } = { disconnect: true }) => {
			if(disconnect) {
				const removed = this.subscribers.indexOf(subscriber);
				/*<@debug>*/
				if(removed < 0) throw `Attempt to delete an subscriber out of the container`;
				/*</@debug>*/
				this.subscribers.splice(removed, 1);
			}
			this.controller.send({
				//todo cross ver support
				dissolve: disconnect,
				disconnect, ...args
			});
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
	
	connectable() {
		return new Connectable( this );
	}
	
	map(project) {
		return new Stream2(null, (e, controller) => {
			controller.to(this.on( (data, record) => {
				if(isKeySignal(data)) {
					return e(data, record);
				}
				e(project(data), record);
			} ));
		});
	}
	
	filter(project) {
		return new Stream2(null, (e, controller) => {
			controller.to(this.on( (data, record) => {
				if(isKeySignal(data)) {
					return e(data, record);
				}
				const res = project(data);
				res && e(data, record);
			} ));
		});
	}
	
	distinct(equal) {
		return new Stream2(null, (e, controller) => {
			let state = EMPTY_OBJECT;
			controller.to(this.on( (data, record) => {
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
			} ));
		});
	}
	
	_activate( subscriber ) {
		const emmiter = this.createEmitter( subscriber );
		this.project.call(this.ctx, emmiter, this.controller);
	}
	
	createEmitter( subscriber ) {
		return (data, record = { ttmp: getTTMP() }) => {
			/*<@debug>*/
			if(!this.subscribers.includes(subscriber)) {
				throw "More unused stream continues to emit data";
			}
			/*</@debug>*/
			
			//todo temporary cross ver support
			if(isKeySignal(data)) {
				return ;
			}
			
			subscriber(data, record );
		};
	}
	
	createController(  ) {
		return new Controller(  );
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
			controller.to(this.on((evt, record) => {
				if (Observable.keys.includes(evt)) {
					return e(evt, record);
				}
				const _e = (evt, _record) => e(evt, _record || record);
				return handler(_e, evt);
			}))
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
			controller.to( ...sourcestreams.map( (stream, i) => {
				return stream.on( (data, record) => {
					if(Observable.keys.includes(data)) {
						return e( data, record );
					}
					sourcestreamsstate[i] = data;
					if(!sourcestreamsstate.includes(EMPTY_OBJECT)) {
						e(project(...sourcestreamsstate), record);
					}
				} );
			} ) );
		} );
	}
	
	withlatest(sourcestreams = [], project = STATIC_PROJECTS.AIO) {
		return new Stream2( null, (e, controller) => {
			const sourcestreamsstate = new Array(sourcestreams.length).fill( EMPTY_OBJECT );
			controller.todisconnect( ...sourcestreams.map( (stream, i) => {
				return stream.on( (data, record) => {
					if(isKeySignal(data)) {
						return e( data, record );
					}
					sourcestreamsstate[i] = data;
				} );
			} ) );
			controller.to( this.on( (data, record) => {
				if(isKeySignal(data)) {
					return e( data, record );
				}
				if(!sourcestreamsstate.includes(EMPTY_OBJECT)) {
					e(project(data, ...sourcestreamsstate), record);
				}
			} ) );
		} );
	}
	
	log() {
		return new Stream2( this, (e, controller) => {
			controller.to(this.on((data, record) => {
				console.log(data);
				e(data, record);
			}));
		});
	}

	/**
	 * Кеширует линию потока, чтобы новые стримы не создавались
	 */
	endpoint() {
		return new EndPoint( null, (e, controller) => {
			controller.to(this.on(e));
		} );
	}
	
	/**
	 * @param {RemouteService} remoteservicecontroller - Remoute service controller connection
	 * @param {Object} stream - Stream name from server
	 */
	static fromRemouteService( remoteservicecontroller, stream ) {
		return new Stream2(null, (e, controller) => {
			const connection = { id: GLOBAL_CONNECTIONS_ID_COUNTER ++ };
			let hook = remoteservicecontroller.on( ({ event, data, connection: { id } }, record) => {
				if(event === "remote-service-ready") {
					hook({
						type: "subscribe",
						stream,
						connection,
					});
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
			} );
			controller.to(hook);
		} );
	}
	
	static ups(UPS = 100) {
		const factor = UPS / 1000;
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
			}, 500 / UPS);
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
		let remouteserviceconnectionstatus = "pending";
		return new RemouteService(null, (e, controller) => {
			if(!websocketconnection) {
				websocketconnection = new WebSocket(`ws://${host}:${port}`);
			}
			if(remouteserviceconnectionstatus === "ready") {
				e( { event: "remoute-service-ready", connection: { id: -1 }, data: null } );
			}
			function onsocketmessagehandler({ data: raw }) {
				const msg = JSON.parse(raw);
				if(msg.event === "remoute-service-ready") {
					remouteserviceconnectionstatus = "ready";
					e( msg );
				}
			}
			function onsocketopendhandler() {
				controller.tocommand( ({ request }) => {
					websocketconnection.send( JSON.stringify({ request, connection }) );
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
			websocketconnection.addEventListener("message", onsocketmessagehandler);
			controller.todisconnect( () => {
				websocketconnection.removeEventListener("message", onsocketmessagehandler);
			} );
		} );
	}

}

export class Controller {
	
	constructor() {
		this.disconnected = false;
		this._todisconnect = [];
		this._tocommand = [];
		this._to = [];
	}
	
	todisconnect(...connectors) {
		this._todisconnect.push(...connectors);
	}
	
	to(...connectors) {
		this._to.push(...connectors);
	}
	
	tocommand( ...connectors ) {
		this._tocommand.push( ...connectors );
	}

	send( data ) {
		if(data.disconnect) {
			this.disconnected = true;
			this._todisconnect.map( connector => connector(data) );
		}
		else {
			this._tocommand.map( connector => connector(data) );
		}
		this._to.map( connector => connector(data) );
	}

}

export class Connectable extends Stream2 {
	
	constructor( sourcestreams ) {
		super(sourcestreams, (e, controller) => {
			controller.to( sourcestreams.on(e) );
		});
		this._activations = [];
	}
	
	connect() {
		this._activations.map( subscriber => super._activate(subscriber) );
	}
	
	_activate( subscriber ) {
		this._activations.push( subscriber );
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

	_activate() {
		if(!this._activated) {
			super._activate();
			this._activated = true;
		}
	}

}

export class Reducer extends Stream2 {

	/**
	 * @param sourcestreams {Stream2|null} Operational stream
	 * @param project {Function}
	 * @param state {Object|Stream2} Initial state (from static or stream)
	 */
	constructor(sourcestreams, project = (_, data) => data, state = EMPTY_OBJECT) {
		const type = state instanceof Stream2 ? 1/*"slave"*/ : 0/*"internal"*/;
		super(sourcestreams, (e, controller) => {
			let srvRequesterHook = null;
			if(state !== EMPTY_OBJECT) {
				if(type === 1) {
					controller.to(srvRequesterHook = state.on( e ));
				}
				else {
					e( state, { ttmp: getTTMP() } );
				}
			}
			if(sourcestreams) {
				controller.todisconnect(sourcestreams.on( (data, record ) => {
					state = project(state, data);
					const grid = type === 1 ? GLOBAL_REQUEST_ID_COUNTER ++ : -1;
					record = { ...record, grid, confirmed: !type };
					e( state, record );
					if(type === 1) {
						srvRequesterHook({ grid, data, record });
					}
				} ));
			}
			if(!sourcestreams && !state) {
				/*<@debug>*/
				console.warn("This stream is always empty.");
				/*</@debug>*/
			}
		});
		this._activated = false;
		this._quene = [];
	}
	
	get quene() {
		return this._quene;
	}
	
	createEmitter( subscriber ) {
		if(!this.emitter) {
			this.emitter = (data, record = { ttmp: getTTMP() }) => {
				this.quene.push( [ data, record ] );
				if(this.quene.length > 1) {
					this._normilizeQuene();
				}
				this.subscribers.map( subscriber => subscriber(data, record) );
			};
		}
		return this.emitter;
	}
	
	_activate() {
		if(!this._activated) {
			super._activate();
			this._activated = true;
		}
	}
	
	_normilizeQuene() {
		const currentTTMP = getTTMP();
		let firstUnobseloteMSGIndex = this.quene
			.findIndex( ( [, {ttmp}]) => ttmp > currentTTMP - MAX_MSG_LIVE_TIME_MS );
		if(firstUnobseloteMSGIndex === this.quene.length - 1) {
			firstUnobseloteMSGIndex -- ;
		}
		if(firstUnobseloteMSGIndex > 0) {
			this.quene.splice( 0, firstUnobseloteMSGIndex + 1);
		}
		else {
			this.quene.splice( 0, this.quene.length - 1);
		}
	}
	
	on( subscriber ) {
		const hook = super.on( subscriber );
		this.quene.map( ([data, record]) =>
			this.subscribers.map(subscriber => subscriber(data, record))
		);
		return hook;
	}

}

Stream2.KEY_SIGNALS = KEY_SIGNALS;
const isKeySignal = Stream2.isKeySignal;
const MAX_MSG_LIVE_TIME_MS = 7000;