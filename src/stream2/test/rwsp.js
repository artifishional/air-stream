import { stream2 as stream } from "../../index.mjs";
import {Record, WSP} from "../wsp";
import {async} from "../../utils";
import {RedWSP} from "../rwsp";
import {STTMP} from "../sync-ttmp-controller";

describe('RedWSP', function () {
	
	test('Forwarding a confirmed event', () => {
	
		const rwsp = new RedWSP(
			() => (count, add) => count + add,
		);
		
		rwsp.fill([
			new Record(rwsp, 7, STTMP.get(1)),
			new Record(rwsp, 13, STTMP.get(2)),
			new Record(rwsp, 25, STTMP.get(3)),
		]);
		
		rwsp.boiler(new Record(rwsp, 12, STTMP.get(4)));
		
		expect(rwsp.state.slice(-1)[0].value).toEqual(37);
		
	});
	
	//В зависимости от типа записи определяется вариант управления
	//Для remote red записей не требуется повторная регистрация
	
});