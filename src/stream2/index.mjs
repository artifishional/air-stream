import Observable, {keyA} from '../observable/index.mjs'
import getTTMP from "./get-ttmp.mjs"
import {CONNECT, EMPTY} from "./signals";
import {Record, WSpring} from "./well-spring";


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
	
	constructor(proJ, ctx = null) {
		//this.subscribers = [];
		/*<@debug>*/
		this._label = "";
		/*</@debug>*/
		this.project = proJ;
		this.ctx = ctx;
	}
	
	get(getter) {
		return new Stream2((connect, control) => {
			this.connect( (evtChWSpS, hook) => {
				control.to(hook);
				connect( evtChWSpS );
				return solid => solid.map( rc => getter(rc.value, rc) )
			});
		}).connect();
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
	 * @param {Function} proJ - Mapper project function
	 * @returns {Stream2}
	 */
	static from(source, proJ) {
		if(source instanceof Promise) {
			return this.fromPromise(source, proJ);
		}
		throw new TypeError("Unsupported source type");
	}
	
	fromCbFunc( loader ) {
		return new Stream2( (cNect) => {
			loader( cNect() );
		} ).store();
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
	static with(streams, hnProJ, sync = true) {
		
		class Handler {
			
			constructor( owner, ctr, emt, hnProJ, streams = [] ) {
				this.streams = new Map();
				this.owner = owner;
				this.emt = emt;
				this.neighbourStreamsBySource = new Map();
				this.ctr = ctr;
				this.hn = hnProJ( this );
				streams.map( stream => this.attach(stream, this.hn) );
			}
			
			hnEvent(e, rec, stream) {
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
			
			attach( stream, handler = this.hn ) {
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
						this.hnEvent(e, rec, stream);
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
		
		return new Stream2((connect, ctr) => {
			const hn = new Handler( this, ctr, emt, hnProJ, streams );
		});
	}

	store() {
		return new Reducer( null, null, this );
	}
	
	map(project) {
		return new Stream2((connect, control) => {
			this.connect( (evtStreamsSRC, hook) => {
				control.to(hook);
				const e = connect( evtStreamsSRC );
				return soliD => e(soliD.map( rec => rec.map( project ) ));
			});
		});
	}
	
	filter(project) {
		return new Stream2((connect, control) => {
			this.connect( (evtStreamsSRC, hook) => {
				control.to(hook);
				const e = connect( evtStreamsSRC );
				return soliD => e(soliD.filter( rec => project(rec.value, rec) ));
			} );
		});
	}
	
	/*<@debug>*/
	log() {
		return new Stream2( (conect, control) => {
			this.connect((evtStreamsSRC, hook) => {
				control.to( hook );
				const e = conect( evtStreamsSRC );
				return (solid) => {
					solid.map(rec => console.log(rec.value));
					e(solid);
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
		this.project.call(this.ctx, (evtChWSpS) => {
			//when projectable stream connecting rdy
			return this.createEmitter( connector( evtChWSpS, hook ), evtChWSpS);
		}, controller);
		return controller;
	}

	_deactivate( connector, controller ) {
		controller.send("disconnect", null);
	}
	
	createEmitter( subscriber, evtChWSpS ) {
		/*<@debug>*/
		return (solid) => {
			if(!Array.isArray(evtChWSpS)) {
				throw new TypeError("Zero spring chanel produced some data?");
			}
			if(evtChWSpS.some( wsp => !(wsp instanceof WSpring) )) {
				throw new TypeError("WSpring event sources only supported");
			}
			if(!Array.isArray(solid) || solid.some( rec => !(rec instanceof Record))) {
				throw new TypeError("Solid array of WellSpring records expected");
			}/*
			if(!this.subscribers.includes(subscriber)) {
				throw "More unused stream continues to emit data";
			}*/
			subscriber(solid);
		};
		/*</@debug>*/
		return subscriber;
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
			throw `${this.src._label}: This controller is already disconnected`;
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

Stream2.KEY_SIGNALS = KEY_SIGNALS;
const isKeySignal = Stream2.isKeySignal;

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