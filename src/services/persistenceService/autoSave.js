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

import { onStateChange, STATE_EVENTS } from '../../modules/state/stateEvents.js';
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
		dispose: () => {},
		getStatus: () => ({
			dirty: false,
			saving: false,
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
 * before a save fires. `saveNow` keeps the coalescing/`rev` correctness so a
 * mid-save edit is never lost.
 *
 * @param {() => Partial<AppState>} getStateFn
 * @param {{ debounceMs?: number, onSaveError?: (error: Error, result: Object) => void }} [options]
 * @returns {{ saveNow: () => Promise<{ ok: boolean, error?: Error, skipped?: boolean }>, dispose: () => void, getStatus: () => Object, unsubscribe?: UnsubscribeFn }}
 */
export function enablePersistenceAutoSave(getStateFn, { debounceMs = 2000, onSaveError } = {}) {
	if (typeof getStateFn !== 'function') return createNoopController();

	let dirty = false;
	let rev = 0;
	let saveInFlight = null;
	let lastSavedAt = null;
	let lastError = null;
	let disposed = false;

	function getStatus() {
		return {
			dirty,
			saving: Boolean(saveInFlight),
			lastSavedAt,
			lastError,
		};
	}

	function saveNow() {
		if (saveInFlight) return saveInFlight;
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
			// A mid-save edit bumped rev and left dirty set, save the newer
			// snapshot now that saveInFlight is nulled.
			if (ok && dirty && !disposed) {
				void saveNow();
			}
		});

		return saveInFlight;
	}

	const scheduleSave = debounce(() => { void saveNow(); }, debounceMs);

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
