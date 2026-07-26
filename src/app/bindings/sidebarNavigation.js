/**
 * CHIVE sidebar navigation workflow.
 *
 * Wires the sidebar step buttons (advance, edit columns, go to panel, back to
 * viz). Each button records the target tab in the active dataset's config;
 * the resulting state event drives the tab and sidebar render.
 */

import { updateActiveDatasetConfig } from '../../state/appState.js';
import { WORKSPACE_ACTION_IDS } from '../../features/datasetWorkspace/domIds.js';

/**
 * Internal workflow setup, called by `app/domBindings.js`.
 * Wires the sidebar navigation buttons.
 */
export function setupSidebarNavigationButtons() {
	const advanceButton = document.getElementById(WORKSPACE_ACTION_IDS.advanceButton);
	const editColumnsButton = document.getElementById('btn-edit-columns');
	const goToPanelButton = document.getElementById('btn-go-to-panel');
	const backToVisualizationsButton = document.getElementById('btn-back-to-viz');

	if (advanceButton) {
		advanceButton.addEventListener('click', () => {
			navigateToTab('charts');
		});
	}

	if (editColumnsButton) {
		editColumnsButton.addEventListener('click', () => {
			navigateToTab('preview');
		});
	}

	if (goToPanelButton) {
		goToPanelButton.addEventListener('click', () => {
			navigateToTab('panel');
		});
	}

	if (backToVisualizationsButton) {
		backToVisualizationsButton.addEventListener('click', () => {
			navigateToTab('charts');
		});
	}
}

/**
 * Navigate UI and active dataset config to a specific tab. The facade is the
 * no-dataset guard: updateActiveDatasetConfig no-ops without an active dataset.
 * @private
 */
function navigateToTab(tabName) {
	updateActiveDatasetConfig({ activeTab: tabName });
}
