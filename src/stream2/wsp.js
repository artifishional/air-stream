import { DEFAULT_TOKEN, EMPTY } from './signals';
import { STTMP } from './sync-ttmp-controller';

let WSP_ID_COUNT = 1;

export class WSP {

	constructor( streams = [], hnProJ = null, id = WSP_ID_COUNT ++ ) {
		this.curFrameCachedRecord = null;
		this.streams = new Map(streams.map(stream => [ stream, {
			stream,
			eventChWSpS: null,
			neighbours: [],
		} ]));
		this.id = id;
		this.slaves = new Set();
		this.neighbourStreamsBySource = new Map();
		if(!streams.length) {
			this.originWSpS = [ this ];
		}
		else if(streams.length === 1) {
			this.originWSpS = streams[0].originWSpS;
		}
		else {
			this.originWSpS = [ ...streams.reduce(
				( acc, { originWSpS } ) => {
					originWSpS.forEach(wsp => acc.add(wsp));
					return acc;
				}, new Set()
			) ];
		}
		this.event5tore = null;
		streams.map(stream => {
			const streamRelatedData = this.streams.get(stream);
			stream.originWSpS.forEach( wsp => {
				let neighbourStreams = this.neighbourStreamsBySource.get(wsp);
				if (!neighbourStreams) {
					this.neighbourStreamsBySource.set(wsp, neighbourStreams = []);
				}
				neighbourStreams.push(streamRelatedData);
			} );
		});
		if(hnProJ) {
			this.hn = hnProJ( this );
		}
		this.lastedstoken = DEFAULT_TOKEN;
		streams.map(stream => stream.on(this));
	}

	handleEvent( stream, cuR ) {
		// grouping
		// каждое сообщение (или группу если поддерживается несколько событий
		// в рамках одного sttmp) из солид необходимо разместить в ячейке
		// для исходного потока и для исходного sttmp
		// так как после каждого события необходимо дождаться ответа от всех
		// потоков, а также необходимо сохранять очередность использования данных
		// в функции хендлера согласно очередности потоков в this.streams
		// синхронизируются сообщения только ОДНОГО источника
		if(!this.event5tore) {
			this.event5tore = new Map();
		}
		const exist = this.event5tore;
		let streamExist = exist.get( cuR.owner );
		const neighbours = this.neighbourStreamsBySource.get(cuR.owner);
		if(!streamExist) {
			exist.set(
				cuR.owner,
				streamExist = new Map(
					neighbours
						.map( ({ stream }) => [ stream,
							null /* cuR from stream from cur sttmp */
						] )
				)
			);
		}
		// если формирование массива исходных потоков происходит динамически
		// (одновременно с получением данных из потоков)
		else if(streamExist.size !== neighbours.length) {
			exist.set(cuR.owner, streamExist = new Map(
				neighbours
					.map( ({ stream }) => [ stream, streamExist.get(stream) ] )
			));
		}
		streamExist.set(stream, cuR);
		const event5tore = [...this.event5tore.keys()];
		//TODO: need perf refactor
		for(let i = 0; i < event5tore.length; i ++ ) {
			const streams = [ ...this.event5tore.get( event5tore[i] ) ];
			// TODO: любая первая запись
			const rec = streams[0][1];
			// only synced msg's here
			if(streams.some( ([, rec ]) => !rec )) { return; }
			this.event5tore.delete(event5tore[i]);
			const updates = streams.filter( ([, rec ]) => rec.value !== EMPTY);
			if(updates.length) {
				this.next( this.createRecordFrom( rec, this.hn(
					updates.map( ([ stream, rec ]) => [ rec.value, stream, rec ] )
				) ) );
			}
			else {
				this.next( this.createRecordFrom(rec, EMPTY ));
			}
		}
	}

	createRecordFrom(rec, updates) {
		return rec.from( updates, Record );
	}

	handleReTouch( stream, cuRt4 ) {

	}

	rt4(t4queue) {
		this.t4queue = t4queue;
		this.slaves.forEach( slv => slv.handleReTouch(this, t4queue) );
	}

	off( slv ) {
		this.slaves.delete(slv);
	}

	on( slv ) {
		if(this.curFrameCachedRecord && this.curFrameCachedRecord.token === STTMP.get()) {
			slv.handleEvent(this, this.curFrameCachedRecord)
		}
		else {
			this.curFrameCachedRecord = null;
		}
		this.slaves.add(slv);
	}
	
	get( proJ ) {
		return new WSP( [ this ],
			() => ( [ [ update ] ] ) => {
			proJ(update);
			return update
		} );
	}
	
	next( rec ) {
		this.curFrameCachedRecord = rec;
		this.slaves.forEach( slv => slv.handleEvent(this, rec) );
	}
	
	rec(value, token = STTMP.get()) {
		/*<@debug>*/
		if(token === this.lastedstoken || this.lastedstoken.sttmp >= token.sttmp) {
			throw new Error("More than one event at a time for the current source");
		}
		this.lastedstoken = token;
		/*</@debug>*/
		this.next( new Record(this, value, token) );
	}

	map( proJ ) {
		return new WSP( [ this ],
			() => ( [ [ update ] ] ) => proJ(update)
		);
	}

	filter( proJ ) {
		return new WSP( [ this ],
			() => ( [ [ update ] ] ) => proJ(update) && update || EMPTY
		);
	}
	
}

export class Record {
	
	constructor( owner, value, token, head = this ) {
		this.origin = head;
		this.value = value;
		this.owner = owner;
		this.token = token;
	}
	
	map(fn) {
		if(this.value === EMPTY) {
			return this;
		}
		return new Record( this.owner, fn(this.value, this), this.token, this.origin );
	}

	filter(fn) {
		if(this.value === EMPTY) {
			return this;
		}
		if(fn(this.value, this)) {
			return this;
		}
		else {
			return new Record( this.owner, EMPTY, this.token, this.origin );
		}
	}

	//TODO: redic. species set
	from(value, species = Record, owner = this.owner) {
		return new species( owner, value, this.token, this.origin );
	}
	
}

export const RED_RECORD_STATUS = {
	PENDING: 	0,
	FAILURE: -1,
	SUCCESS: 	1,
};

export class WssChannel {

	constructor ( ws ) {
		this.ws = ws;
		this.ws.addEventListener("message", this);
		this.subscribers = new Set();
	}

	handleEvent( raw ) {
		const data = JSON.stringify( raw );
		this.subscribers.forEach( rec => rec.onRequestReady(data) );
	}

	on( rec ) {
		this.subscribers.add( rec );
	}

	off( rec ) {
		this.subscribers.delete( rec );
	}

	send( data ) {
		const raw = JSON.parse( data );
		this.ws.send( raw );
	}

}

export class RedRecord extends Record {

	constructor ( owner, value, token, origin ) {
		super( owner, value, token, origin );
	}

	static get STATUS() {
		return RED_RECORD_STATUS;
	}

}