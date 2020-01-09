import { stream2 as stream } from "../../index.mjs";
import { Record, RED_RECORD_STATUS, RedMRecord, WSP } from '../wsp';
import {async} from "../../utils";
import {RedWSP} from "../rwsp";
import {STTMP} from "../sync-ttmp-controller";

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
		expect(rwsp.state.slice(-1)[0].value).toEqual(37);
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
		expect(rwsp.state.slice(-1)[0].value).toEqual(37);
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
		expect(rwsp.state.slice(-1)[0].value).toEqual(25);
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
			12,
			STTMP.get(4),
			undefined,
			RED_RECORD_STATUS.PENDING
		));
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
		expect(rwsp.state.slice(-1)[0].value).toEqual(25);
	});

});