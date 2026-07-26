/**
 * CHIVE stored-data clearing workflow.
 *
 * Confirms, resets in-memory state, then wipes the persisted project with
 * project saves held off. Its trigger lives in the settings dialog rather than
 * in static markup, so this module exports a handler instead of a listener setup
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
import { acquireProjectOperation } from './projectOperationLock.js';

/** @typedef {{ ok: boolean, cancelled?: boolean, busy?: boolean, reason?: string }} ClearStoredDataResult */

/**
 * Prompt for confirmation, then clear the browser-stored project.
 *
 * Two things can undo a wipe, and each has its own guard. A project import
 * running in another workflow persists the file it read after the wipe
 * finishes, so the shared project-operation lock is taken before the
 * confirmation is even shown. A project save started before the wipe lands
 * after it, so the deletion runs inside `withSavesSuspended`, which settles
 * every write already in flight, refuses new ones, and reschedules work that
 * turned dirty during the wipe instead of dropping it. That last part matters:
 * the settings dialog stays closable while this runs, so the user can return to
 * the workspace and start editing before the deletion completes.
 *
 * The in-memory reset happens first so the workspace empties immediately. It is
 * safe there because `replaceAllState` emits `STATE_HYDRATED`, which auto-save
 * classifies as not dirty, so the reset itself never schedules a write.
 *
 * @param {{ withSavesSuspended?: <T>(operation: () => Promise<T>) => Promise<T> }} [dependencies]
 * @returns {Promise<ClearStoredDataResult>} `cancelled` marks a declined confirmation and `busy` a refused start, neither of which is a failure of the wipe itself.
 */
export async function clearStoredProjectData({ withSavesSuspended } = {}) {
	const release = acquireProjectOperation('clear');
	if (!release) return { ok: false, busy: true };

	try {
		const confirmed = await openConfirmDialog({
			title: t('chive-settings-data-clear-confirm-title'),
			message: t('chive-settings-data-clear-confirm'),
			confirmLabel: t('chive-confirm-continue'),
			cancelLabel: t('chive-confirm-cancel'),
		});
		if (!confirmed) return { ok: true, cancelled: true };

		try {
			replaceAllState({ data: { datasets: [], activeIndex: -1 }, panel: {} });

			const runExclusively = typeof withSavesSuspended === 'function'
				? withSavesSuspended
				: operation => operation();
			const result = await runExclusively(() => clearPersistedState());

			if (result && result.ok === false) {
				console.warn('[chive:persist] stored data was not cleared:', result.reason);
				return { ok: false, reason: result.reason || 'error' };
			}
			return { ok: true };
		} catch (err) {
			console.warn('[chive:persist] clearing stored data failed:', err);
			return { ok: false, reason: 'error' };
		}
	} finally {
		release();
	}
}
