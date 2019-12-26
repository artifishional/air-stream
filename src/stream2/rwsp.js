import { RedRecord, Record, WSP } from './wsp';


export class RedWSP extends WSP {
	
	/**
	 *
	 * @param {Array.<Record>} reliable
	 * @param {Function} hnProJ
	 */
	constructor(reliable, hnProJ) {
		super([], hnProJ);
		this.redSlaves = [];
		//если среди стримов есть хотябы один контроллер - то это мастер редьюсер,
		//мастер редьюсер должен получить начальное состояние извне
		//в ином случае состояние создается на базе мастер стримов

		//В первой хранится текущее (надежное) состояние
		//Во второй очереди хранятся события в исходном виде
		//Второая очередь является дополнением к первой

		//В третьей очереди хранится результирующее состояние
		//Причем первый элемент является бессрочным

		//действия могут быть отменены в результате исключения
		//это значит что для любого действия требуется короткое ожидание
		this.reliable = reliable;
		this.t4queue = [];
		this.state = [ ...reliable ];
	}

	createRecordFrom(rec, updates) {
		return rec.from( updates, RedRecord );
	}

	onRecordStatusUpdate( rec ) {

		const indexOf = this.t4queue.indexOf( rec );



		this.redSlaves.forEach( slv => slv.handleR(this) );

		if(rec.status === RedRecord.STATUS.SUCCESS) {

			if(indexOf === 0) {
				this.t4queue.shift();
			}


		}
		else if(rec.status === RedRecord.STATUS.FAILURE) {
			this.
		}
	}

	next( rec ) {
		rec.on( this );
		this.t4queue.push( rec );
		this.reliable.push( rec );
		super.next( rec );
	}
	
	map( proJ ) {
		return new RedSlaveWSP( [ this ],
			() => ( [ [ update ] ] ) => proJ(update)
		);
	}
	
}

export class RedSlaveWSP extends WSP {
	
	constructor( streams, hnProJ ) {
		super(  );
		this.hn = hnProJ( this );
		if(streams.length === 1) {
			this.state = streams.state.map( rec => {
				return rec.from( this.hn(
					updates.map( ([ stream, rec ]) => [ rec.value, stream, rec ] )
				) )
			} );
		}
	}
	
	handleR( state ) {
		//логика работы аналогична работе с кадрами
		//если общее состояние одного из накопителей меняется
		//то нужно дождаться изменения состояний всех связанных накопителей
		//затем необходимо произвести обновление
		streams.map(  );
	}
	
}