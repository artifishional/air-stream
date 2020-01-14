import {
	Record,
	RED_RECORD_LOCALIZATION,
	RED_RECORD_STATUS,
	RED_RECORD_SUBORDINATION,
	RedRecord,
} from '../record';
import {RedWSP} from "../rwsp";
import {STTMP} from "../sync-ttmp-controller";
import {WSP} from "../wsp";
import {stream2 as stream} from "../index";

function prop(prop) {
	return data => data[prop];
}

describe('RedWSP', function () {
	
	test('Forwarding a confirmed event', () => {
		const rwsp = new RedWSP(
			() => (count, add) => count + add,
		);
		rwsp.fill([
			new Record(null, rwsp, 25, STTMP.get(3)),
		]);
		rwsp.propagate(new RedRecord(
			null,
			rwsp,
			12,
			STTMP.get(4),
			undefined,
			{
				subordination: RED_RECORD_SUBORDINATION.MASTER,
				status: RED_RECORD_STATUS.SUCCESS,
				localization: RED_RECORD_LOCALIZATION.REMOTE
			}
		));
		expect(rwsp.state.slice(-2).map(prop("value"))).toEqual([25, 37]);
	});

	test('Forwarding a unconfirmed event', () => {
		const rwsp = new RedWSP(
			() => (count, add) => count + add,
		);
		rwsp.fill([
			new Record(null, rwsp, 25, STTMP.get(3)),
		]);
		rwsp.propagate(new RedRecord(
			null,
			rwsp,
			12,
			STTMP.get(4),
			undefined,
			{
				subordination: RED_RECORD_SUBORDINATION.MASTER,
				status: RED_RECORD_STATUS.PENDING,
				localization: RED_RECORD_LOCALIZATION.REMOTE
			}
		));
		expect(rwsp.state.slice(-2).map(prop("value"))).toEqual([25, 37]);
	});

	test('Event from controller - consecutive cancellation', () => {
		const rwsp = new RedWSP(
			() => (count, add) => count + add,
		);
		rwsp.fill([
			new Record(null, rwsp, 25, STTMP.get(3)),
		]);
		const aeR = new RedRecord(
			null,
			rwsp,
			12,
			STTMP.get(4),
			undefined,
			{
				subordination: RED_RECORD_SUBORDINATION.MASTER,
				status: RED_RECORD_STATUS.PENDING,
				localization: RED_RECORD_LOCALIZATION.REMOTE
			}
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
			new Record(null, rwsp, 25, STTMP.get(3)),
		]);
		rwsp.propagate(new RedRecord(
			null,
			rwsp,
			2,
			STTMP.get(1),
			undefined,
			{
				subordination: RED_RECORD_SUBORDINATION.MASTER,
				status: RED_RECORD_STATUS.PENDING,
				localization: RED_RECORD_LOCALIZATION.REMOTE
			}
		));
		const aeR = new RedRecord(
			null,
			rwsp,
			1,
			STTMP.get(2),
			undefined,
			{
				subordination: RED_RECORD_SUBORDINATION.MASTER,
				status: RED_RECORD_STATUS.PENDING,
				localization: RED_RECORD_LOCALIZATION.REMOTE
			}
		);
		rwsp.propagate(aeR);
		rwsp.propagate(new RedRecord(
			null,
			rwsp,
			-3,
			STTMP.get(3),
			undefined,
			{
				subordination: RED_RECORD_SUBORDINATION.MASTER,
				status: RED_RECORD_STATUS.PENDING,
				localization: RED_RECORD_LOCALIZATION.REMOTE
			}
		));
		aeR.onRecordStatusUpdate(aeR, RED_RECORD_STATUS.FAILURE);
		rwsp.onRecordStatusUpdate(aeR, RED_RECORD_STATUS.FAILURE);
		expect(rwsp.state.slice(-3).map(prop("value"))).toEqual([25, 27, 24]);
	});
	
	test('Transform segment type from remote to local', () => {
		const rwsp = new RedWSP(
			() => (count, add) => count + add,
		);
		const rwsp2 = new RedWSP(
			() => (count, add) => count + add,
			{ localization: RED_RECORD_LOCALIZATION.REMOTE }
		);
		rwsp.fill([
			new Record(null, rwsp, 25, STTMP.get(3)),
		]);
		rwsp.propagate(new RedRecord(
			null,
			rwsp2,
			2,
			STTMP.get(1),
			undefined,
			{
				subordination: RED_RECORD_SUBORDINATION.MASTER,
				status: RED_RECORD_STATUS.PENDING,
				localization: RED_RECORD_LOCALIZATION.LOCAL
			}
		));
		expect(rwsp.state.slice(-1).map(prop("localization")))
			.toEqual([RED_RECORD_LOCALIZATION.REMOTE]);
		expect(rwsp.state.slice(-2).map(prop("value"))).toEqual([25, 27]);
	});
	
});