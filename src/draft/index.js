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
  (/* owner */) => (updates) => ({
    propA: combined[0],
    propB: combined[1],
  })
);


stream.extV1.combine([
    stream1,
    [stream2, { name: 'some', sync: false }],
    [stream3, { name: 0 }],
],
  // updates - массив записей
  // combined - массив последних записей, разобранных
  //  по индексам в соответсвии с каждым входным потоком
  

  ({ $ }) => (combined, updates) => {
    // combined - состояние с уже примененными обновлениями
    // updates - последние примененные обновления
    
    // updates
    // массив / хэш с обновлениями

    // дождаться результата, и если были изменения
    // то провеизвести reT4
  
    return {}; // активное состояние
    //return $({}) //пассивное состояние
  },
  
  {
    // хэндлер не выполняется каждый раз, когда вызывается
    // текущий combiner, вместо этого он вызывает один раз
    // когда будет расчитано полное состояние (reT4)
    // handler
    tuner(tuner) {
      // boxes структура потоков (object)
      // streamBox.value - текущее значение
      // streamBox.src - ссылка на поток
      // streamBox.hook - доступ к контроллеру (контроллер асинхронный)
      // streamBox.name - имя, если доступно, или индекс
      tuner.setup([
        // add if not exist
        stream1,
        // add if not exist
        [stream2, { on: true }],
        // add with name if not exist
        // setup name if exist
        [stream2, { on: true, key: 'some' }],
        // del at instance if exist
        [stream2, { on: false }],
        // del at name if exist
        [, { key: 'some', on: false }],
      ]);
    }
  }
  
  
  // по умолчанию дистинкт по ссылке?
  // по умолчанию дистинкт первого уровня?
  
);
