/**
 * CHIVE application initializer.
 *
 * Owns initialization order and the top-level error boundary. Rendering and
 * render-affecting state subscriptions are delegated to renderCoordinator.js.
 */

import { initializeI18n, t } from '../services/i18nService.js';
import {
	isPersistenceAvailable,
	hydrateState,
	enablePersistenceAutoSave,
	getPersistenceErrorMessageKey,
} from '../services/persistence.js';
import { getPersistenceSnapshot, replaceAllState } from '../state/appState.js';
import { rehydratePanelChartSpecs } from '../utils/panelHydration.js';
import { throttle } from '../utils/throttle.js';
import { initChartControls } from '../modules/chartControls/chartControlsManager.js';
import { initPanelController } from '../features/panel/panelController.js';
import { initDatasetController } from '../features/datasetWorkspace/datasetController.js';
import { initializeAllEventHandlers } from '../modules/eventHandlers.js';
import { initSettingsController } from '../modules/settingsController.js';
import { SETTINGS_CHANGE_EVENT } from '../config/settings.js';
import { showFeedback, showError } from '../modules/feedbackUI.js';
import {
	livePreviewRender,
	runFullRefreshNow,
	scheduleFullRefresh,
	setupStateSubscriptions,
} from './renderCoordinator.js';

/**
 * Initialize CHIVE in dependency order. Shared i18n/settings setup runs on
 * every page; app-only wiring stops when the main application shell is absent.
 *
 * @returns {Promise<void>}
 */
export async function initializeApplication() {
	await initializeI18n();
	initSettingsController();

	if (!document.getElementById('file-info')) return;

	if (isPersistenceAvailable()) {
		await hydrateState({
			replaceAllState,
			transformPanel: rehydratePanelChartSpecs,
		});
	}

	initDatasetController();
	// Live color and height previews are rate-limited because heavy charts can
	// otherwise re-render on every pointer event. Leading and trailing throttle
	// behavior preserves the first and final preview values.
	initChartControls(null, throttle(livePreviewRender, 120));
	initPanelController(showFeedback);

	initializeAllEventHandlers();
	setupStateSubscriptions();

	enablePersistenceAutoSave(getPersistenceSnapshot, {
		onSaveError: reportPersistenceSaveError,
	});

	runFullRefreshNow();

	window.addEventListener('chive-locale-changed', scheduleFullRefresh);
	window.addEventListener(SETTINGS_CHANGE_EVENT, event => {
		if (event?.detail?.key === 'tinColorRendering') scheduleFullRefresh();
	});
	window.addEventListener('chive-internal-error', event => {
		const message = event?.detail?.message || t('chive-error-internal');
		showError(message);
	});
}

/**
 * Start initialization behind the top-level error boundary. This is the
 * single-start lifecycle entry used by main.js, not an idempotent utility.
 */
export function startApplication() {
	initializeApplication().catch(reportInitializationError);
}

/**
 * @param {unknown} error
 */
function reportPersistenceSaveError(error) {
	showError(t(getPersistenceErrorMessageKey(error)));
}

function internalErrorMessage() {
	try {
		return t('chive-error-internal');
	} catch {
		return 'An internal application error occurred.';
	}
}

/**
 * @param {unknown} error
 */
function reportInitializationError(error) {
	document.body.style.visibility = 'visible';
	console.error('CHIVE initialization failed:', error);
	showError(internalErrorMessage());
}
