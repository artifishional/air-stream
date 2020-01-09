import { stream2 as stream } from "../../index.mjs";
import { Record, RED_RECORD_STATUS, RedMRecord, WSP } from '../wsp';
import {async} from "../../utils";
import {RedWSP} from "../rwsp";
import {STTMP} from "../sync-ttmp-controller";

function prop(prop) {
	return data => data[prop];
}

describe('RedWSP', function () {
	
	test('Forwarding a confirmed event', () => {
		const rwsp = new RedWSP(
			() => (count, add) => count + add,
		);
		rwsp.fill([
			new Record(rwsp, 25, STTMP.get(3)),
		]);
		rwsp.propagate(new RedMRecord(
			rwsp,
			12,
			STTMP.get(4),
			undefined,
			RED_RECORD_STATUS.SUCCESS
		));
		expect(rwsp.state.slice(-2).map(prop("value"))).toEqual([25, 37]);
	});

	test('Forwarding a unconfirmed event', () => {
		const rwsp = new RedWSP(
			() => (count, add) => count + add,
		);
		rwsp.fill([
			new Record(rwsp, 25, STTMP.get(3)),
		]);
		rwsp.propagate(new RedMRecord(
			rwsp,
			12,
			STTMP.get(4),
			undefined,
			RED_RECORD_STATUS.PENDING
		));
		expect(rwsp.state.slice(-2).map(prop("value"))).toEqual([25, 37]);
	});

	test('Event from controller - consecutive cancellation', () => {
		const rwsp = new RedWSP(
			() => (count, add) => count + add,
		);
		rwsp.fill([
			new Record(rwsp, 25, STTMP.get(3)),
		]);
		const aeR = new RedMRecord(
			rwsp,
			12,
			STTMP.get(4),
			undefined,
			RED_RECORD_STATUS.PENDING
		);
		rwsp.propagate(aeR);
		aeR.onRecordStatusUpdate(aeR, RED_RECORD_STATUS.FAILURE);
		rwsp.onRecordStatusUpdate(aeR, RED_RECORD_STATUS.FAILURE);
		expect(rwsp.state.slice(-1).map(prop("value"))).toEqual([25]);
	});

	test('Event from controller - non consecutive cancellation', () => {
		const rwsp = new RedWSP(
			() => (count, add) => count + add,
		);
		rwsp.fill([
			new Record(rwsp, 25, STTMP.get(3)),
		]);
		rwsp.propagate(new RedMRecord(
			rwsp,
			2,
			STTMP.get(1),
			undefined,
			RED_RECORD_STATUS.PENDING
		));
		const aeR = new RedMRecord(
			rwsp,
			1,
			STTMP.get(2),
			undefined,
			RED_RECORD_STATUS.PENDING
		);
		rwsp.propagate(aeR);
		rwsp.propagate(new RedMRecord(
			rwsp,
			-3,
			STTMP.get(3),
			undefined,
			RED_RECORD_STATUS.PENDING
		));
		aeR.onRecordStatusUpdate(aeR, RED_RECORD_STATUS.FAILURE);
		rwsp.onRecordStatusUpdate(aeR, RED_RECORD_STATUS.FAILURE);
		expect(rwsp.state.slice(-3).map(prop("value"))).toEqual([25, 27, 24]);
	});

});