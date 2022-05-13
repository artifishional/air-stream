import { stream } from "../src/index.mjs"

const src = stream(
	//streams
	[a, b], //or named form { a: stream, b: stream }
	//producer (optional)
	({a, b},
	    sourcename, /*or indexed if anonymous form*/ /*also has 'controller' name*/
		sourcesction
	) =>
		//if undefined -> then not emitted but updated the state
		[ state, action, privatestate],
	//controller (optional)
	(request, data = {}, state = null/*producer*/) =>
		//для кадждого потока
		({5:data}), // or named form ({a:data})
		//для управления state'om
		({ controller: data }),
	//connector (optional)
	(state/*producer*/, privatestate) =>
		//if undefined -> then not changed
		({ a: { type: "sync" }, b: { type: "sync" }  }), // or indexed if anonymous form
);

//нужна форма записи, при которой
//1. Определены все источники изменения, если это потоки
//2. Нет возможности получать события, от неопределнных источников
//3. Нет возможности создавать события, от неопределнных источников
//4. Есть возможность обрабатывать обратные реквесты (controller)
//5. Контроллер должен иметь доступ к общему состоянию,
//   --> ??? а основной цикл - к контроллеру <--
// Если основной цикл имеет доступ к контроллеру, то в общем случае на него
// можно будет влиять при перерасчете состояния, но это будет противоречием
//6. Контроллер не способен повлиять на коннектор
//7. Контроллер должен иметь возможность оказывать влияение на состояние
//   --> ??? что делать с потоками, которые недоступны в момент инициализации <--

stream( [ stream.from.timeout(1000) ], () => [



] );

stream( [ stream.from.observer(1000) ], () => [

] );

stream( [ stream.from.event(obj, event) ], () => [

] );

stream( [ stream.from.websocket(url) ], () => [

] );