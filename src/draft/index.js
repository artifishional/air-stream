/* eslint-disable */

/**
 * @param {Function.<Function>} handler Reducer acc project constructor
 * @param {Stream} remote Remote recovery stream
 */

reduce((owner) => (acc, next, rec) => {}, { remote });

/**
 * handle bottom controllers msg's
 */
handle(() => {})
  .withLatest([r1, r2], project)
  .reduce((owner) => (acc, next, rec) => {}, { remote });


// how to sync evt from the same controller?
// same controller's events do not synced
// handle is a evt src

const s1 = handle(() => {});
const s2 = handle(() => {});

stream
  .controller(s1, project)
  .controller(s2, project);


const rwsp1 = stream
  .reduce((/* owner */) => (acc, next/* , rec */) => acc + next, { remote: rm1 });
const rwsp2 = stream
  .reduce((/* owner */) => (acc, next/* , rec */) => acc + next, { remote: rm2 });

// acc всегда должен быть определен
// для локальных - в виде статичного начального значения
// для удаленных - в виде open изменений

stream.with( [rwsp1, rwsp2],
  // updates - массив записей
  // combined - массив последних записей, разобранных
  //  по индексам в соответсвии с каждым входным потоком
  (/* owner */) => (updates, combined) => ({
    propA: combined[0],
    propB: combined[1],
  })
);
