/**
 * Construct and install CHIVE's browser-console debug surface.
 *
 * This is not a stable application API. Production modules must import their
 * dependencies directly instead of reaching through `window.chiveDebug`.
 */

import { getState, getActiveDataset } from '../state/appState.js';
import {
	enableStateLog,
	disableStateLog,
	getStateLog,
	clearStateLog,
} from '../state/stateEvents.js';
import { getStateSummary } from '../state/stateDebug.js';
import { getLoadedDatasets } from '../features/datasetWorkspace/datasetController.js';
import {
	runFullRefreshNow,
	updateDatasetColumns,
	updateDatasetConfig,
} from './renderCoordinator.js';
import { showFeedbackMessage, showErrorMessage } from './feedbackUI.js';
import { switchTab } from './uiManager.js';

/**
 * @returns {Object}
 */
export function createDebugApi() {
	return {
		getState,
		getStateSummary,
		getActiveDataset,
		getLoadedDatasets,
		updateDatasetColumns,
		updateDatasetConfig,
		switchTab,
		refreshView: runFullRefreshNow,
		showFeedback: showFeedbackMessage,
		showError: showErrorMessage,
		enableStateLog,
		disableStateLog,
		getStateLog,
		clearStateLog,
	};
}

/**
 * @param {Window} [target=window]
 * @returns {Object}
 */
export function installDebugApi(target = window) {
	target.chiveDebug = createDebugApi();
	return target.chiveDebug;
}
