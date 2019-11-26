import Observable, {keyA} from '../observable/index.mjs'
import getTTMP from "./get-ttmp.mjs"
import {CONNECT} from "./signals";
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
const TYPES = { PIPE: 0, STORE: 1, };

export class Stream2 {
	
	static isKeySignal(data) {
		return KEY_SIGNALS.has(data);
	}
	
	constructor(proJ, ctx = null) {
		this.connections = new Map();
		/*<@debug>*/
		this._label = "";
		/*</@debug>*/
		this.project = proJ;
		this.ctx = ctx;
		this.type = new.target.TYPES.PIPE;
	}
	
	get(getter) {
		return new Stream2((connect, control) => {
			this.connect( (evtChWSpS, hook) => {
				control.to(hook);
				connect( evtChWSpS );
				return rec => getter(rec.value, rec)
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
		
		/**
		 * Как убедиться в том что данные получены полнотсью в момент коннекта стрима?
		 *
		 * Один из вариантов - отказаться от мультиплекс событий для одинаковых sttmp
		 * тогда нужно уметь синхронизировать их внутри hn функции
		 * для этого данной функции придеться учитывать природу источника событий потоков
		 * либо явно указывать каким образом обрабатываютя синхронные события,
		 * при условии что каждая rec будет переслана (даже для пустых сообщений)
		 */
		
		if(!sync) {
			throw new Error("Async mode currently is not supported");
		}
		
		class Handler {
			
			constructor( owner, connect, control, hnProJ, streams = [] ) {
				this.streams = new Map();
				this.owner = owner;
				this.connect = connect;
				this.vent = null;
				this.neighbourStreamsBySource = new Map();
				this.control = control;
				this.hn = hnProJ( this );
				this.event5tore = new Map();
				this.attach(streams, this.hn);
			}
			
			onStreamEvent(stream, soliD) {
				
				// Если режим sync то дожидаться подключения всех потоков
				// not connected
				if(!this.vent) {
					return;
				}
				
				// grouping
				// каждое сообщение (или группу если поддерживается несколько событий
				// в рамках одного sttmp) из солид необходимо разместить в ячейке
				// для исходного потока и для исходного sttmp
				// так как после каждого события необходимо дождаться ответа от всех
				// потоков, а также необходимо сохранять очередность использования данных
				// в функции хендлера согласно очередности потоков в this.streams
				
				// синхронизируются сообщения только ОДНОГО источника
				soliD.forEach( ( rec ) => {
					const exist = this.event5tore;
					let streamExist = exist.get( rec.owner );
					const neighbours = this.neighbourStreamsBySource.get(rec.owner);
					if(!streamExist) {
						exist.set(
							rec.owner,
							streamExist = new Map(
								neighbours
									.map( ({ stream }) => [ stream,
										null /* soliD from stream from cur sttmp */
									] )
							)
						);
					}
					// если формирование массива исходных потоков происходит динамически
					// (одновременно с получением данных из потоков)
					else if(streamExist.size !== neighbours.length) {
						exist.set(rec.owner, streamExist = new Map(
							neighbours
								.map( ({ stream }) => [ stream, streamExist.get(stream) ] )
						));
					}
					streamExist.set(stream, rec);
				} );
			
				// if there are still streams with a similar source
				const sortedSTTMP = [...this.event5tore.keys()].sort( (a, b) => a - b );

				for(let i = 0; i < sortedSTTMP.length; i ++ ) {
					// only synced msg's here
					const streams = this.event5tore.get( sortedSTTMP[i] );
					//TODO: need perf refactor
					const soliDStacks = [ ...streams.values().next().value ];
					const rec = soliDStacks[0][1];
					
					debugger;
					
					if(soliDStacks.some( ([, rec ]) => !rec )) {
						return ;
					}
			
					this.vent([ rec.from( this.hn(
						soliDStacks.map( ([ stream, rec ]) => [ stream, rec.value, rec ] )
					) ) ]);
				}
			}

			onStreamConnect(stream, eventChWSpS, eventChHook, own) {
				this.control.to(eventChHook);
				const streamRelatedData = this.streams.get(stream);
				streamRelatedData.eventChWSpS = eventChWSpS;
				eventChWSpS.forEach( wsp => {
					let neighbourStreams = this.neighbourStreamsBySource.get(wsp);
					if (!neighbourStreams) {
						this.neighbourStreamsBySource.set(wsp, neighbourStreams = []);
					}
					neighbourStreams.push(streamRelatedData);
				} );
				if(!this.vent && [...this.streams.values()].every( ({eventChWSpS}) => eventChWSpS )) {
					// all streams connected here
					this.vent = this.connect( [ ...this.neighbourStreamsBySource.keys() ] );
				}
				return (soliD) => {
					this.onStreamEvent(stream, soliD);
				};
			}
			
			attach( streams, handler = this.hn ) {

				// primary streams initialization
				streams
					.forEach( stream => {
						const conf = {
							handler,
							stream,
							eventChWSpS: null,
							neighbours: [],
						};
						this.streams.set(stream, conf);
						return stream;
					});
				// then hooks realize
				streams
					.forEach( stream => {
						stream.connect((eventChWSpS, eventChHook, own) =>
							this.onStreamConnect(stream, eventChWSpS, eventChHook, own)
						);
						return this;
					});
			}
			
			detach( stream ) {
				//unsubscribe
				//clear neighbour queue cell
				//clear neighbour state queue cell
				this.streams.delete(stream);
				return this;
			}
			
		}
		
		return new Stream2((connect, control) => {
			const hn = new Handler( this, connect, control, hnProJ, streams );
		});
	}
	
	map(proJ) {
		return new Stream2((connect, control) => {
			this.connect((evtChWSpS, hook, own) => {
				control.to(hook);
				const e = connect(evtChWSpS, own);
				return rec => e(rec.map(proJ));
			});
		});
	}
	
	filter(proJ) {
		return new Stream2((connect, control) => {
			this.connect((evtChWSpS, hook, own) => {
				control.to(hook);
				const e = connect(evtChWSpS, own);
				return rec => e(rec.filter(proJ));
			} );
		});
	}
	
	/*<@debug>*/
	log() {
		return new Stream2( (conect, control) => {
			this.connect((evtChWSpS, hook) => {
				control.to( hook );
				const e = conect( evtChWSpS );
				return rec => {
					console.log(rec.value);
					e(rec);
				}
			});
		});
	}
	/*</@debug>*/
	
	connect( connect = () => () => {} ) {
		this.connections.set(connect, null);
		const control = this.createController();
		const hook = (action = "disconnect", data = null) => {
			/*<@debug>*/
			if(typeof action !== "string") {
				throw new TypeError("Action must be a string only");
			}
			/*</@debug>*/
			if(action === "disconnect") {
				this._deactivate( connect, control );
			}
			else {
				control.send(action, data);
			}
		};
		this._activate( control, connect, hook );
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
	
	registerSubscriber( connect, subscriber ) {
		// if deactivation occurred earlier than the subscription
		if(this.connections.has(connect)) {
			this.connections.set(connect, subscriber);
		}
	}
	
	_activate( control = this.createController(), connect, hook ) {
		this.project.call(this.ctx, (evtChWSpS, own = this) => {
			return this.startConnectionToSlave(connect, evtChWSpS, own, hook);
		}, control);
	}
	
	startConnectionToSlave(connect, evtChWSpS, own, hook) {
		//when projectable stream connecting rdy
		const subscriber = connect( evtChWSpS, hook, own );
		this.registerSubscriber( connect, subscriber );
		return this.createEmitter( subscriber, evtChWSpS);
	}

	_deactivate( connect, controller ) {
		this.connections.delete(connect);
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

Stream2.FROM_OWNER_STREAM = FROM_OWNER_STREAM;
Stream2.TYPES = TYPES;
Stream2.KEY_SIGNALS = KEY_SIGNALS;
stream2.TYPES = TYPES;
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