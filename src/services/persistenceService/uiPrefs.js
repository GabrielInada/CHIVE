/**
 * UI-preference storage (localStorage).
 *
 * The single owner of the `chive.ui` localStorage key: every read, write, and
 * clear of UI prefs goes through here so the key and its quirks stay in one
 * place. Internal to the persistenceService facade.
 */

const UI_LOCAL_STORAGE_KEY = 'chive.ui';

/**
 * @internal
 * @returns {Object | null} Parsed UI prefs, or null when absent/unreadable.
 */
export function readUiPrefs() {
	try {
		const raw = localStorage.getItem(UI_LOCAL_STORAGE_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

/**
 * @internal
 * @param {Object} ui
 */
export function writeUiPrefs(ui) {
	try {
		localStorage.setItem(UI_LOCAL_STORAGE_KEY, JSON.stringify(ui || {}));
	} catch {
		// Quota exceeded or sandboxed, nothing actionable from here.
	}
}

/**
 * Remove the stored UI prefs. Keeps the localStorage key private to this
 * module so callers never reach into the storage details themselves.
 *
 * @internal
 */
export function clearUiPrefs() {
	try {
		localStorage.removeItem(UI_LOCAL_STORAGE_KEY);
	} catch {
		// ignore
	}
}
