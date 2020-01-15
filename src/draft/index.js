
/**
 * @param {Function.<Function>} handler Reducer acc project constructor
 * @param {Stream} remote Remote recovery stream
 */

reduce( (owner) => (acc, next, rec) => {}, { remote } );

/**
 * handle bottom controllers msg's
 */
handle( () => {} )
    .withLatest( [r1, r2], project )
    .reduce( (owner) => (acc, next, rec) => {}, { remote } );
	

// how to sync evt from the same controller?
// same controller's events do not synced
// handle is a evt src

const
  s1 = handle( () => {} ),
  s2 = handle( () => {} );

  stream
    .controller( s1, project )
    .controller( s2, project );