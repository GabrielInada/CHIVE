/**
 * Browser storage capacity and eviction-resistance helpers.
 *
 * Capacity reads are safe during settings rendering. Persistent-storage
 * permission is exposed separately so callers invoke it only from an explicit
 * user action.
 */

import { ok, fail } from '../utils/result.js';

function getStorageManager() {
	return globalThis.navigator?.storage || null;
}

/**
 * @returns {Promise<{ ok: true, usage: number, quota: number, persisted: boolean } | { ok: false, reason: string }>}
 */
export async function getStorageStatus() {
	const storage = getStorageManager();
	if (!storage || typeof storage.estimate !== 'function') {
		return fail('storage-unsupported');
	}

	try {
		const [estimate, persisted] = await Promise.all([
			storage.estimate(),
			typeof storage.persisted === 'function' ? storage.persisted() : false,
		]);
		return ok({
			usage: Number.isFinite(estimate?.usage) ? estimate.usage : 0,
			quota: Number.isFinite(estimate?.quota) ? estimate.quota : 0,
			persisted: Boolean(persisted),
		});
	} catch {
		return fail('storage-status-failed');
	}
}

/**
 * Request eviction resistance. Call only in direct response to a user action.
 *
 * @returns {Promise<{ ok: true, granted: boolean } | { ok: false, reason: string }>}
 */
export async function requestPersistentStorage() {
	const storage = getStorageManager();
	if (!storage || typeof storage.persist !== 'function') {
		return fail('storage-unsupported');
	}

	try {
		return ok({ granted: Boolean(await storage.persist()) });
	} catch {
		return fail('storage-persist-failed');
	}
}
