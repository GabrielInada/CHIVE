/**
 * CHIVE shared-page initializer.
 *
 * Runs the setup common to every HTML page: i18n bundle loading plus the
 * header settings controller. Both the full application entry
 * (`entries/app.js`, via `applicationInitializer.js`) and the standalone
 * About entry (`entries/about.js`) call this. It imports only i18n and
 * settings, so an entry that needs nothing else stays clear of the chart,
 * state, panel, and persistence graphs.
 */

import { initializeI18n } from '../services/i18nService.js';
import { initSettingsController } from './settingsController.js';

/**
 * Load i18n, then wire the header settings button. Settings wiring waits for
 * i18n so the dialog and static labels resolve against the active locale.
 *
 * @returns {Promise<void>}
 */
export async function initializeSharedPage() {
	await initializeI18n();
	initSettingsController();
}
