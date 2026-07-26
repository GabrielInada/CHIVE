/**
 * CHIVE stored-data clearing workflow.
 *
 * Confirms, resets in-memory state, settles any pending save, then wipes the
 * persisted project. Its trigger lives in the settings dialog rather than in
 * static markup, so this module exports a handler instead of a listener setup
 * function; the application initializer injects it as a callback, which is what
 * keeps persistence and state out of the About page's import graph.
 *
 * Scope matches `clearPersistedState`: the SQLite project image, the legacy
 * `chive-state` database, and the `chive.ui` preferences. The selected locale
 * and the app settings survive.
 */

import { t } from '../../services/i18nService.js';
import { clearPersistedState } from '../../services/persistence.js';
import { replaceAllState } from '../../state/appState.js';
import { openConfirmDialog } from '../../ui/confirmDialog.js';

/**
 * Prompt for confirmation, then clear the browser-stored project.
 *
 * Order matters. Resetting first is safe because `replaceAllState` emits
 * `STATE_HYDRATED`, which auto-save classifies as not dirty, so the reset itself
 * never schedules a write. Awaiting the flush then settles a save that was
 * already in flight with the pre-clear snapshot, which would otherwise land
 * after the wipe and restore the data; a merely dirty controller writes the
 * already-empty snapshot instead, which the wipe removes a moment later.
 *
 * @param {{ flushPendingSave?: () => Promise<*> }} [dependencies]
 * @returns {Promise<{ ok: boolean, cancelled?: boolean }>} `cancelled` marks a declined confirmation, which is not a failure.
 */
export async function clearStoredProjectData({ flushPendingSave } = {}) {
	const confirmed = await openConfirmDialog({
		title: t('chive-settings-data-clear-confirm-title'),
		message: t('chive-settings-data-clear-confirm'),
		confirmLabel: t('chive-confirm-continue'),
		cancelLabel: t('chive-confirm-cancel'),
	});
	if (!confirmed) return { ok: true, cancelled: true };

	try {
		replaceAllState({ data: { datasets: [], activeIndex: -1 }, panel: {} });
		if (typeof flushPendingSave === 'function') {
			// A flush that fails must not block a wipe the user explicitly asked
			// for. Worst case this falls back to the unflushed race, which is
			// where the code stood before the flush existed.
			try {
				await flushPendingSave();
			} catch (err) {
				console.warn('[chive:persist] could not settle a pending save before clearing:', err);
			}
		}
		await clearPersistedState();
		return { ok: true };
	} catch (err) {
		console.warn('[chive:persist] clearing stored data failed:', err);
		return { ok: false };
	}
}
