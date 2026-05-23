/**
 * Standardized result objects for operations that can succeed or fail.
 * See the {@link Result} typedef in `src/types.js` for the union shape.
 *
 * Usage:
 *   return ok()                     → { ok: true }
 *   return ok({ chartId: 123 })     → { ok: true, chartId: 123 }
 *   return fail()                   → { ok: false }
 *   return fail('no-data')          → { ok: false, reason: 'no-data' }
 *
 * The success-data fields spread onto the result object — there is no
 * `.value` wrapper. Pick reasons from a stable string set; callers branch
 * on `reason` to localize.
 *
 * @typedef {import('../types.js').Result} Result
 */

/**
 * Build a success result. When `data` is an object, its fields are spread
 * onto the result alongside `ok: true`.
 *
 * @param {Object} [data]
 * @returns {Result}
 */
export function ok(data) {
	if (data && typeof data === 'object') {
		return { ok: true, ...data };
	}
	return { ok: true };
}

/**
 * Build a failure result. `reason` is attached only when truthy so that
 * `fail()` with no argument yields a clean `{ ok: false }`.
 *
 * @param {string} [reason]
 * @returns {Result}
 */
export function fail(reason) {
	if (reason) {
		return { ok: false, reason };
	}
	return { ok: false };
}
