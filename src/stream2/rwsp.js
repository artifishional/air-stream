import { RedRecord, Record, WSP } from './wsp';
import {STTMP} from "./sync-ttmp-controller";


export class RedWSP {
	
	/**
	 * @param {Function} hnProJ
	 * @param {Function} createRecordFrom
	 */
	constructor(hnProJ, { createRecordFrom = null } = {}) {
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
		this.reliable = null;
		this.hn = hnProJ( this );
		this.t4queue = null;
		this.state = null;

		if(createRecordFrom) {
			//создается запись
			//контейнер создает запрос
			//в результате контейнер вызывает метод реакции
			this.createRecordFrom = createRecordFrom;
		}
	}
	
	next( cuR ) {
		if( cuR instanceof RedRecord ) {
			/**
			 * In case of remote control
			 */
			if(cuR.status === 1) {
				//требуется проверка очередности
				const rec = this.createRecordFrom(
					cuR, this.hn( this.state.slice(-1)[0].value, cuR.value )
				);
				this.t4queue.push( rec );
				this.reliable.push( rec );
				this.state.push( rec );
			}
			else {
				const rec = this.createRecordFrom(
					cuR, this.hn( this.state.slice(-1)[0].value, cuR.value )
				);
				this.t4queue.push( rec );
				this.reliable.push( rec );
				this.state.push( rec );
				this.next( rec );
			}
		}
		else {
			const rec = this.createRecordFrom(
				cuR, this.hn( this.state.slice(-1)[0].value, cuR.value )
			);
			this.t4queue.push( rec );
			this.reliable.push( rec );
			this.state.push( rec );
			rec.on(this);
			this.next( rec );
		}
	}
	
	fill( state ) {
		this.t4queue = [];
		this.reliable = state;
		this.state = [ ...state ];
	}

	//как передать ссылку на поток соединения минуюя данный класс?
	createRecordFrom(rec, updates) {
		return rec.from( updates, RedRecord );
	}

	onRecordStatusUpdate( rec, status ) {
		const indexOf = this.t4queue.indexOf( rec );
		this.redSlaves.forEach( slv => slv.handleR(this) );
		if(status === RedRecord.STATUS.SUCCESS) {
			if(indexOf === 0) {
				this.t4queue.shift();
			}
		}
		else if(status === RedRecord.STATUS.FAILURE) {
			const deleteCount = this.state.length - this.reliable.length;
			this.t4queue.shift();
			this.state.splice(
				this.reliable.length,
				deleteCount,
				...this.t4queue.map( rec => {} )
			);
		}
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