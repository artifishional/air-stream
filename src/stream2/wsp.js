import { DEFAULT_TOKEN, EMPTY } from './signals';

let WSP_ID_COUNT = 0;

export const TTMP = new class TTMPSyncController {

	constructor () {
		this.token = null;
		this.cbs = [];
	}

	get(ttmp = -1) {
		if(!this.token) {
			if(ttmp === -1) ttmp = globalThis.performance.now();
			this.token = { sttmp: ttmp };
			debugger;
			queueMicrotask(() => {
				this.token = null;
				this.cbs.map( cb => cb() );
			} );
		}
		return this.token;
	}

	async(cb) {
		this.get();
		this.cbs.push(cb);
	}

};

export class WSP {

	constructor( streams = [], hnProJ = null, id = WSP_ID_COUNT ++ ) {
		this.id = id;
		this.slaves = new Set();
		this.streams = new Map();
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
		streams.map(stream => stream.on(this));
		this.hn = hnProJ( this );
		this.lastedstoken = DEFAULT_TOKEN;
	}

	handle( stream, origRec ) {
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
		let streamExist = exist.get( origRec.owner );
		const neighbours = this.neighbourStreamsBySource.get(origRec.owner);
		if(!streamExist) {
			exist.set(
				origRec.owner,
				streamExist = new Map(
					neighbours
						.map( ({ stream }) => [ stream,
							null /* origRec from stream from cur sttmp */
						] )
				)
			);
		}
		// если формирование массива исходных потоков происходит динамически
		// (одновременно с получением данных из потоков)
		else if(streamExist.size !== neighbours.length) {
			exist.set(origRec.owner, streamExist = new Map(
				neighbours
					.map( ({ stream }) => [ stream, streamExist.get(stream) ] )
			));
		}
		streamExist.set(stream, origRec);

		const event5tore = [...this.event5tore.keys()];
		//TODO: need perf refactor
		for(let i = 0; i < event5tore.length; i ++ ) {
			const streams = [ ...this.event5tore.get( event5tore[i] ) ];
			// TODO: любая первая запись
			const rec = streams[0][1];
			// only synced msg's here
			if(streams.some( ([, rec ]) => !rec )) { return; }
			this.event5tore.delete(event5tore[i]);
			const updates = streams.filter( ([, rec ]) => !rec.empty);
			if(updates.length) {
				this.rec( rec.from( this.hn(
					updates.map( ([ stream, rec ]) => [ stream, rec.value, rec ] )
				) ), origRec );
			}
			else {
				this.rec( EMPTY, origRec );
			}
		}
	}

	off( slv ) {
		this.slaves.delete(slv);
	}

	on( slv ) {
		this.slaves.add(slv);
	}
	
	rec(value, origRec = null, token = TTMP.get()) {
		/*<@debug>*/
		if(token === this.lastedstoken || this.lastedstoken.sttmp >= token.sttmp) {
			throw new Error("More than one event at a time for the current source");
		}
		/*</@debug>*/
		this.lastedstoken = token;
		const rec = origRec ? origRec.from(value) : new Record(this, value, token);
		this.slaves.forEach( slv => slv.handle(this, rec) );
	}

	map( proJ ) {
		return new WSP( [ this ], () => ( [ [ update ] ] ) => proJ(update) );
	}

	filter( proJ ) {
		return new WSP( [ this ],
			() => ( [ [ update ] ] ) => proJ(update) && update || EMPTY
		);
	}
	
}

export class Record {
	
	constructor( owner, value, token, origin = this ) {
		this.origin = origin;
		this.value = value;
		this.owner = owner;
		this.token = token;
		this.sttmp = token.sttmp;
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
	
	from(value) {
		return new Record( this.owner, value, this.token, this.origin );
	}
	
}