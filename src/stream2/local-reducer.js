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
			eventCh.connect( (eventChWSpS, eventChHook) => {
				control.todisconnect( eventChHook );
				const feeder = connect( [ STATIC_SYNC_WELL_SPRING, ...eventChWSpS ] );
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