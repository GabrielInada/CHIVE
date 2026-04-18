/**
 * Standardized result objects for operations that can succeed or fail.
 *
 * Usage:
 *   return ok()                     → { ok: true }
 *   return ok({ chartId: 123 })     → { ok: true, chartId: 123 }
 *   return fail()                   → { ok: false }
 *   return fail('no-data')          → { ok: false, reason: 'no-data' }
 */

export function ok(data) {
	if (data && typeof data === 'object') {
		return { ok: true, ...data };
	}
	return { ok: true };
}

export function fail(reason) {
	if (reason) {
		return { ok: false, reason };
	}
	return { ok: false };
}
