/**
 * Throttle `fn` so it runs at most once per `wait` ms. The first call of a
 * burst runs immediately (leading); calls landing inside the window are
 * coalesced into one deferred run with the latest args (trailing), so the
 * final value always lands. The returned wrapper exposes:
 *
 *   - `cancel()`, drop the pending trailing invocation, if any.
 *
 * This exists alongside `debounce` because the live chart preview needs
 * rate limiting, not quiet-period detection: a color picker drag or a
 * height drag emits events faster than any sensible wait, so a debounce
 * would never paint until the user pauses.
 *
 * @template {(...args: *) => *} F
 * @param {F} fn
 * @param {number} wait - Minimum gap between invocations in milliseconds.
 * @returns {F & { cancel: () => void }}
 */
export function throttle(fn, wait) {
	let timer = null;
	let lastArgs = null;
	let lastThis = null;
	let lastInvokeTime = -Infinity;

	function invoke() {
		const args = lastArgs;
		const thisArg = lastThis;
		timer = null;
		lastArgs = null;
		lastThis = null;
		lastInvokeTime = Date.now();
		fn.apply(thisArg, args);
	}

	function throttled(...args) {
		lastArgs = args;
		lastThis = this;
		if (timer !== null) return;
		const remaining = wait - (Date.now() - lastInvokeTime);
		if (remaining <= 0) {
			invoke();
		} else {
			timer = setTimeout(invoke, remaining);
		}
	}

	throttled.cancel = () => {
		if (timer !== null) clearTimeout(timer);
		timer = null;
		lastArgs = null;
		lastThis = null;
	};

	return throttled;
}
