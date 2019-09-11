import "./node-perf-hooks.js"

let cache = -1;

export default function getTTMP() {
	if(cache === -1) {
		cache = _getTTMP();
		setTimeout( () => {
			cache = -1;
		} );
	}
	return cache;
}

const _getTTMP = () => performance.now() | 0;