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
 * Initialized from `app/applicationInitializer.js` right after i18n, before
 * the app-only early return, so settings work on both `index.html` and
 * `about.html`. Listener
 * setup is idempotent and pages without the header button are tolerated.
 */

import { getLocale, setLocale } from '../services/i18nService.js';
import { getTinColorRendering, setTinColorRendering } from '../services/settingsService.js';
import { openSettingsDialog } from '../components/settingsDialog.js';
import { SETTINGS_IDS } from '../config/elementIds.js';

let dialogOpen = false;

/**
 * Wire the header settings button. Safe to call more than once (a bound
 * button is not re-bound) and on documents without the button.
 */
export function initSettingsController() {
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
			onClose: () => {
				dialogOpen = false;
				button.setAttribute('aria-expanded', 'false');
			},
		});
	});
}
