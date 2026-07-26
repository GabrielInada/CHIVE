/**
 * Debounced project auto-save controller.
 *
 * Subscribes to state changes, coalesces edits over a quiet window, and writes
 * UI prefs immediately. It never touches the storage backend directly: every
 * project save goes through `persistState`, imported as a live binding from
 * `lifecycle.js`, so a backend swapped in after the controller exists is still
 * the one that receives the snapshot.
 *
 * @typedef {import('../../types.js').AppState} AppState
 * @typedef {import('../../types.js').UnsubscribeFn} UnsubscribeFn
 */

import { onStateChange, STATE_EVENTS } from '../../state/stateEvents.js';
import { debounce } from '../../utils/debounce.js';
import { persistState } from './lifecycle.js';
import { errorFrom } from './errors.js';
import { isProjectDirtyEvent, isUiPrefsEvent } from './dirtyTracking.js';
import { writeUiPrefs } from './uiPrefs.js';

function saveUiPrefsFromState(getStateFn) {
	try {
		writeUiPrefs(getStateFn()?.ui || {});
	} catch {
		// Ignore broken state access; project save will report real failures.
	}
}

function createNoopController() {
	const error = new Error('Persistence controller requires a getState function');
	return {
		saveNow: () => Promise.resolve({ ok: false, error }),
		runWithSavesSuspended: operation => Promise.resolve().then(operation),
		dispose: () => {},
		getStatus: () => ({
			dirty: false,
			saving: false,
			suspended: false,
			lastSavedAt: null,
			lastError: null,
		}),
	};
}

/**
 * Subscribe to state changes and auto-save the project on a debounced timer.
 *
 * Each save re-exports the whole SQLite image, heavier than the old
 * structured-clone write, so edits are coalesced over a wide quiet window
 * before a save fires. Revision tracking keeps an edit made during a successful
 * in-flight save dirty and starts one follow-up save after settlement. A failed
 * save remains dirty and reports its error, but receives no automatic retry
 * until another dirty event or explicit/lifecycle `saveNow`; page termination
 * can interrupt asynchronous persistence.
 *
 * `runWithSavesSuspended` is the seam for operations that must own the stored
 * project outright, such as clearing it.
 *
 * @param {() => Partial<AppState>} getStateFn
 * @param {{ debounceMs?: number, onSaveError?: (error: Error, result: Object) => void }} [options]
 * @returns {{ saveNow: () => Promise<{ ok: boolean, error?: Error, skipped?: boolean }>, runWithSavesSuspended: <T>(operation: () => T | Promise<T>) => Promise<T>, dispose: () => void, getStatus: () => Object, unsubscribe?: UnsubscribeFn }}
 */
export function enablePersistenceAutoSave(getStateFn, { debounceMs = 2000, onSaveError } = {}) {
	if (typeof getStateFn !== 'function') return createNoopController();

	let dirty = false;
	let rev = 0;
	let saveInFlight = null;
	let lastSavedAt = null;
	let lastError = null;
	let disposed = false;
	let suspended = false;

	function getStatus() {
		return {
			dirty,
			saving: Boolean(saveInFlight),
			suspended,
			lastSavedAt,
			lastError,
		};
	}

	function saveNow() {
		if (saveInFlight) return saveInFlight;
		if (suspended) return Promise.resolve({ ok: true, skipped: true });
		if (!dirty) return Promise.resolve({ ok: true, skipped: true });

		const revAtStart = rev;
		let ok = false;
		lastError = null;

		saveInFlight = (async () => {
			try {
				const result = await persistState(getStateFn());
				ok = result.ok;
				if (result.ok) {
					lastSavedAt = new Date().toISOString();
					if (rev === revAtStart) dirty = false;
				} else {
					lastError = errorFrom(result.error);
					if (typeof onSaveError === 'function') onSaveError(lastError, result);
				}
				return result;
			} catch (err) {
				lastError = errorFrom(err);
				if (typeof onSaveError === 'function') onSaveError(lastError, { ok: false, error: lastError });
				return { ok: false, error: lastError };
			}
		})().finally(() => {
			saveInFlight = null;
			// After a successful write, a mid-save edit leaves dirty set; save that
			// newer revision now that saveInFlight is cleared. Failures stay dirty
			// and wait for a later event or explicit/lifecycle saveNow call.
			if (ok && dirty && !disposed && !suspended) {
				void saveNow();
			}
		});

		return saveInFlight;
	}

	const scheduleSave = debounce(() => { void saveNow(); }, debounceMs);

	/**
	 * Run an operation with project saves held off, then let them resume.
	 *
	 * Exposed as a wrapper rather than as separate suspend/resume calls because a
	 * caller that forgets to resume silently disables auto-save for the session.
	 *
	 * Settling the in-flight save is a loop, not a single await: a successful save
	 * starts its follow-up from inside its own `finally`, so a newer write can
	 * already be running by the time the first promise resolves. Waiting for all
	 * of them is what lets a caller delete the stored project without a write
	 * landing afterwards and restoring it.
	 *
	 * State that turned dirty while saves were suspended lost its debounce timer,
	 * so resuming reschedules it. Without that, work created during a clear would
	 * be wiped and then never written again until the next unrelated edit.
	 *
	 * @template T
	 * @param {() => T | Promise<T>} operation
	 * @returns {Promise<T>}
	 */
	async function runWithSavesSuspended(operation) {
		suspended = true;
		scheduleSave.cancel();
		try {
			while (saveInFlight) {
				await saveInFlight.catch(() => {});
			}
			return await operation();
		} finally {
			suspended = false;
			if (dirty && !disposed) scheduleSave();
		}
	}

	const unsubscribe = onStateChange(STATE_EVENTS.WILDCARD, event => {
		if (isUiPrefsEvent(event?.type)) {
			saveUiPrefsFromState(getStateFn);
		}

		if (!isProjectDirtyEvent(event)) return;
		dirty = true;
		rev += 1;
		lastError = null;
		scheduleSave();
	});

	// Best-effort close-net: start a pending save as early as the browser gives
	// us a reliable lifecycle signal. `visibilitychange` -> hidden is the
	// primary path while the page is still alive; `pagehide` and the Page
	// Lifecycle `freeze` event, where supported, are backstops. There is no
	// synchronous unload fallback for the multi-MB SQLite byte image: IndexedDB
	// is async, localStorage is too small/string-only, OPFS sync handles are
	// worker-only and unused here, sendBeacon would require a backend, and this
	// write path can cross the persistence worker boundary. `saveInFlight`
	// coalesces duplicate lifecycle triggers, and a clean state is a no-op.
	function flushPendingSave() {
		scheduleSave.cancel();
		if (dirty) void saveNow();
	}

	function handleVisibilityChange() {
		if (document.visibilityState === 'hidden') flushPendingSave();
	}

	if (typeof document !== 'undefined') {
		document.addEventListener('visibilitychange', handleVisibilityChange);
		document.addEventListener('freeze', flushPendingSave);
	}
	if (typeof window !== 'undefined') {
		window.addEventListener('pagehide', flushPendingSave);
	}

	return {
		saveNow,
		runWithSavesSuspended,
		dispose: () => {
			disposed = true;
			scheduleSave.cancel();
			unsubscribe();
			if (typeof window !== 'undefined') {
				window.removeEventListener('pagehide', flushPendingSave);
			}
			if (typeof document !== 'undefined') {
				document.removeEventListener('visibilitychange', handleVisibilityChange);
				document.removeEventListener('freeze', flushPendingSave);
			}
		},
		getStatus,
		unsubscribe,
	};
}
