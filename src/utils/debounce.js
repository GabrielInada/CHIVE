/**
 * Debounce a function. The wrapper exposes:
 * - cancel(): drop the pending invocation, if any
 * - flush(): invoke immediately with the most recent args, if pending
 *
 * flush() is the reason this exists instead of an inline setTimeout —
 * beforeunload needs to commit the last save before the tab dies.
 */
export function debounce(fn, wait) {
	let timer = null;
	let lastArgs = null;
	let lastThis = null;

	function invoke() {
		const args = lastArgs;
		const thisArg = lastThis;
		timer = null;
		lastArgs = null;
		lastThis = null;
		fn.apply(thisArg, args);
	}

	function debounced(...args) {
		lastArgs = args;
		lastThis = this;
		if (timer !== null) clearTimeout(timer);
		timer = setTimeout(invoke, wait);
	}

	debounced.cancel = () => {
		if (timer !== null) clearTimeout(timer);
		timer = null;
		lastArgs = null;
		lastThis = null;
	};

	debounced.flush = () => {
		if (timer === null) return;
		clearTimeout(timer);
		invoke();
	};

	return debounced;
}
