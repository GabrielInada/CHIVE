/**
 * Settings controller.
 *
 * Owns the static header settings button, opens at most one settings dialog
 * at a time, and connects the dialog's callbacks to their owning services:
 * language changes go to `i18nService.setLocale` (the dialog stays open and
 * retranslates in place) and TIN rendering changes go to
 * `settingsService.setTinColorRendering` (whose change event drives the app
 * repaint from `app/renderCoordinator.js`). The dialog component owns the
 * modal DOM; the services own storage.
 *
 * Stored-data clearing is not connected here. It arrives as an injected
 * callback from the application entry and is passed straight through, so this
 * module stays free of persistence and state imports and remains loadable on
 * the About page.
 *
 * Initialized via `app/sharedPageInitializer.js` right after i18n, which runs
 * on both `index.html` and `about.html`, so settings work on every page.
 * Listener setup is idempotent and pages without the header button are
 * tolerated.
 */

import { getLocale, setLocale } from '../../services/i18nService.js';
import { getTinColorRendering, setTinColorRendering } from '../../services/settingsService.js';
import { getStorageStatus, requestPersistentStorage } from '../../services/storageService.js';
import { openSettingsDialog } from './settingsDialog.js';
import { SETTINGS_IDS } from './domIds.js';

let dialogOpen = false;

/**
 * Wire the header settings button. Safe to call more than once (a bound
 * button is not re-bound) and on documents without the button.
 *
 * @param {{ onClearStoredData?: () => Promise<{ ok: boolean, cancelled?: boolean }> }} [options] - Supplied by the application page only; the dialog hides its Data section without it.
 */
export function initSettingsController({ onClearStoredData } = {}) {
	const button = document.getElementById(SETTINGS_IDS.button);
	if (!button) return;
	if (button.dataset.settingsBound === 'true') return;
	button.dataset.settingsBound = 'true';

	button.addEventListener('click', () => {
		if (dialogOpen) return;
		dialogOpen = true;
		button.setAttribute('aria-expanded', 'true');
		openSettingsDialog({
			locale: getLocale(),
			tinColorRendering: getTinColorRendering(),
			onLocaleChange: setLocale,
			onTinColorRenderingChange: setTinColorRendering,
			onGetStorageStatus: getStorageStatus,
			onRequestPersistentStorage: requestPersistentStorage,
			onClearStoredData,
			onClose: () => {
				dialogOpen = false;
				button.setAttribute('aria-expanded', 'false');
			},
		});
	});
}
