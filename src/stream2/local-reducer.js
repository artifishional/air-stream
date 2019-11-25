import {Stream2} from "./index";
import {WSpring} from "./well-spring";
import { StorableAC } from './storable-ac';
const STATIC_SYNC_WELL_SPRING = new WSpring();

export class LocalReducer extends StorableAC {

	/**
	 *
	 * @param eventCh {Stream2} Operational chanel
	 * @param proJ {Function}
	 * @param primary {*} Initial state
	 */
	constructor(eventCh, proJ = (_, data) => data, primary) {
		super( ( connect, control ) => {
			let state = primary;
			eventCh.connect( (evtChWSpS, evtChHook) => {
				control.todisconnect( evtChHook );
				const feeder = connect( [ STATIC_SYNC_WELL_SPRING, ...evtChWSpS ] );
				feeder( [ STATIC_SYNC_WELL_SPRING.rec(state, 0) ] );
				return solid => {
					feeder( solid.map(
						next => next.map( vl => state = proJ( state, vl, next ) )
					) );
				}
			});
		});
	}

}

Stream2.prototype.store = function() {
	return new LocalReducer( this, undefined, 1 );
};