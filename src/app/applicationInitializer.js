/**
 * CHIVE application initializer.
 *
 * Owns initialization order and the top-level error boundary. Rendering and
 * render-affecting state subscriptions are delegated to renderCoordinator.js.
 */

import { t } from '../services/i18nService.js';
import {
	isPersistenceAvailable,
	hydrateState,
	enablePersistenceAutoSave,
	getPersistenceErrorMessageKey,
} from '../services/persistence.js';
import { getPersistenceSnapshot, replaceAllState } from '../state/appState.js';
import { rehydratePanelChartSpecs } from '../domain/panel/rehydration.js';
import { throttle } from '../utils/throttle.js';
import { initChartControls } from '../features/datasetWorkspace/chartControls/chartControlsController.js';
import { initPanelController } from '../features/panel/panelController.js';
import { initDatasetController } from '../features/datasetWorkspace/datasetController.js';
import { VIEW_IDS } from '../features/datasetWorkspace/domIds.js';
import { initializeDomBindings } from './domBindings.js';
import { clearStoredProjectData } from './bindings/clearStoredData.js';
import { initializeSharedPage } from './sharedPageInitializer.js';
import { SETTINGS_CHANGE_EVENT } from '../config/settings.js';
import { showFeedback, showError } from '../ui/feedback.js';
import {
	livePreviewRender,
	runFullRefreshNow,
	scheduleFullRefresh,
	setupStateSubscriptions,
} from './renderCoordinator.js';
import {
	failStartupScreen,
	revealPageShell,
	updateStartupScreen,
} from './startupScreen.js';

// Held so the settings dialog's clear action can hold off project saves while it
// wipes stored data. Assigned below, after hydration; the clear callback is a
// closure, so wiring the dialog earlier than this is safe.
let autoSaveController = null;

/**
 * Initialize CHIVE in dependency order. Shared i18n and settings setup is
 * delegated to initializeSharedPage; app-only wiring stops when the main
 * application shell is absent.
 *
 * @returns {Promise<void>}
 */
export async function initializeApplication() {
	// Shared page setup runs first because everything below depends on i18n. The
	// settings dialog it wires is inside the app shell, which stays hidden and
	// inert until revealPageShell() below, so the clear action is not a recovery
	// route for a startup that never completes.
	await initializeSharedPage({
		onClearStoredData: () => clearStoredProjectData({
			withSavesSuspended: operation => (
				autoSaveController
					? autoSaveController.runWithSavesSuspended(operation)
					: operation()
			),
		}),
	});

	if (!document.getElementById(VIEW_IDS.fileInfo)) {
		revealPageShell();
		return;
	}

	updateStartupScreen(t('chive-startup-restoring'));
	if (isPersistenceAvailable()) {
		await hydrateState({
			replaceAllState,
			transformPanel: rehydratePanelChartSpecs,
			onError: reportPersistenceLoadError,
		});
	}

	updateStartupScreen(t('chive-startup-preparing'));
	initDatasetController();
	// Live color and height previews are rate-limited because heavy charts can
	// otherwise re-render on every pointer event. Leading and trailing throttle
	// behavior preserves the first and final preview values.
	initChartControls(null, throttle(livePreviewRender, 120));
	initPanelController(showFeedback);

	initializeDomBindings();
	setupStateSubscriptions();

	autoSaveController = enablePersistenceAutoSave(getPersistenceSnapshot, {
		onSaveError: reportPersistenceSaveError,
	});

	runFullRefreshNow();
	revealPageShell();

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
 * single-start lifecycle entry used by entries/app.js, not an idempotent utility.
 */
export async function startApplication() {
	try {
		await initializeApplication();
		return true;
	} catch (error) {
		reportInitializationError(error);
		return false;
	}
}

/**
 * @param {unknown} error
 */
function reportPersistenceSaveError(error) {
	showError(t(getPersistenceErrorMessageKey(error)));
}

function reportPersistenceLoadError() {
	showError(t('chive-load-failed'));
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
	console.error('CHIVE initialization failed:', error);
	const message = internalErrorMessage();
	failStartupScreen(message);
	showError(message);
}
