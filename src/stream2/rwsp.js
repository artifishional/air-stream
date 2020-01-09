import { RedMRecord, RedRecord, Record, WSP, RED_RECORD_STATUS } from './wsp';
import {STTMP} from "./sync-ttmp-controller";


export class RedWSP {
	
	/**
	 * @param {Function} hnProJ
	 * @param {Function} createRecordFrom
	 */
	constructor(hnProJ, { createRecordFrom = null } = {}) {
		this.redSlaves = [];
		this.slaves = [];
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

	/**
	 * Источники:
	 * 1. Данные дополенения от текущего удаленного хранилища (в рамках моста)
	 * 	 	- Статус подтвержден
	 * 		- Пересчет позиций
	 * 	 	- Владельцем является текущий store
	 * 2. Данные от потоков контроллера
	 * 		- Должны быть превращены в red master record с запросом на подтверждение
	 * 	 	- Статус не подтвержден
	 * 	 	- Владелец внешний
	 * 3. Данные от соседнего ВНЕШНЕГО хранилища
	 * 	 	- Статус любой
	 * 	 		Соседний store
	 * 	 				может получать новые данные от контроллера,
	 * 	 				может также быть восстановлен готовыми данными с сервера.
	 * 		- Пересчет позиций
	 * 	 	- Владелец внешний
	 * 4. Данные от соседнего ВНУТРЕННЕГО хранилища
	 *    - Являются для данного типа аналогом данных от потоков контроллера
	 */
	propagate( cuR ) {
		const rec = cuR.from(
			this.hn( this.state.slice(-1)[0].value, cuR.value ), RedRecord
		);
		if( cuR instanceof RedRecord ) {
			if(!cuR.status) {
				this.t4queue.push( cuR );
			}
			else {
				this.t4queue.push( cuR );
				this.reliable.push( rec );
			}
		}
		else if( cuR instanceof RedSRecord ) {
			this.t4queue.push( cuR );
		}
		else {
			this.t4queue.push( cuR );
		}
		this.state.push( rec );
		this.next( rec );
	}

	next( rec ) {
		this.slaves.forEach( slv => slv.handleEvent(this, rec) );
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
		this.t4queue.splice( indexOf, 1 );
		if(status === RED_RECORD_STATUS.SUCCESS) {
			if(indexOf === 0) {
				this.reliable.push( this.state[this.reliable.length] );
			}
		}
		else if(status === RED_RECORD_STATUS.FAILURE) {
			this.state.splice(this.reliable.length, Infinity);
			this.t4queue.reduce( (acc, rec) => {
				const res = this.createRecordFrom(
					rec, this.hn( acc.value, rec.value )
				);
				this.state.push(res);
				return res;
			}, this.reliable.slice(-1)[0] );
		}
		this.redSlaves.forEach( slv => slv.handleR(this) );
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