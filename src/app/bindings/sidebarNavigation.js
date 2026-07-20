/**
 * CHIVE sidebar navigation workflow.
 *
 * Wires the sidebar step buttons (advance, edit columns, go to panel, back to
 * viz). Each button both records the target tab in the active dataset's config
 * and switches the visible tab.
 */

import { updateActiveDatasetConfig } from '../../state/appState.js';
import { WORKSPACE_ACTION_IDS } from '../../features/datasetWorkspace/domIds.js';
import { switchTab } from '../uiManager.js';

/**
 * Internal workflow setup, called by `app/domBindings.js`.
 * Wires the sidebar navigation buttons.
 */
export function setupSidebarNavigationButtons() {
	const btnAvancar = document.getElementById(WORKSPACE_ACTION_IDS.advanceButton);
	const btnEditarColunas = document.getElementById('btn-edit-columns');
	const btnIrPainel = document.getElementById('btn-go-to-panel');
	const btnVoltarViz = document.getElementById('btn-back-to-viz');

	if (btnAvancar) {
		btnAvancar.addEventListener('click', () => {
			navigateToTab('charts');
		});
	}

	if (btnEditarColunas) {
		btnEditarColunas.addEventListener('click', () => {
			navigateToTab('preview');
		});
	}

	if (btnIrPainel) {
		btnIrPainel.addEventListener('click', () => {
			navigateToTab('panel');
		});
	}

	if (btnVoltarViz) {
		btnVoltarViz.addEventListener('click', () => {
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
	switchTab(tabName);
}
