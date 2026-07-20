/**
 * CHIVE DOM bindings orchestrator.
 *
 * The single composition point for application event listeners. It owns no
 * listener logic itself; each workflow lives in its own module under
 * `bindings/`:
 *   - `bindings/projectTransfer.js` (project export/import)
 *   - `bindings/sidebarNavigation.js` (sidebar step buttons)
 *   - `bindings/chartActions.js` (download SVG + add-to-panel)
 *   - `bindings/keyboardShortcuts.js` (Ctrl/Cmd+O)
 *   - `features/datasetWorkspace/bindings/datasetActions.js` (delegated select/remove)
 *
 * These four are app-level rather than feature-owned: project transfer owns the
 * whole project, sidebar navigation spans both features, the keyboard shortcut is
 * a global listener, and the chart actions are delegated off static `index.html`
 * markup. Dataset actions stay with the feature that renders their rows.
 *
 * File/sidebar/panel setup stays owned by the dataset controller, uiManager,
 * and panelController; dataset tabs bind lazily from their feature view.
 */

import { setupPanelEventListeners } from '../features/panel/panelController.js';
import { setupFileInputListeners } from '../features/datasetWorkspace/datasetController.js';
import { setupSidebarToggleListener } from './uiManager.js';
import { setupProjectTransferListeners } from './bindings/projectTransfer.js';
import { setupSidebarNavigationButtons } from './bindings/sidebarNavigation.js';
import { setupChartActionListeners } from './bindings/chartActions.js';
import { setupGlobalKeyboardListeners } from './bindings/keyboardShortcuts.js';
import { setupDatasetListeners } from '../features/datasetWorkspace/bindings/datasetActions.js';

/**
 * Wire all DOM listeners by calling each setup function in boot order:
 *   - `setupFileInputListeners` (datasetController)
 *   - `setupSidebarToggleListener` (uiManager)
 *   - `setupSidebarNavigationButtons` (bindings/sidebarNavigation)
 *   - `setupPanelEventListeners` (panelController)
 *   - `setupProjectTransferListeners` (bindings/projectTransfer)
 *   - `setupChartActionListeners` (bindings/chartActions)
 *   - `setupGlobalKeyboardListeners` (bindings/keyboardShortcuts)
 *   - `setupDatasetListeners` (datasetWorkspace/bindings/datasetActions)
 *
 * Called once during app startup from `app/applicationInitializer.js`.
 */
export function initializeDomBindings() {
	setupFileInputListeners();
	setupSidebarToggleListener();
	setupSidebarNavigationButtons();
	setupPanelEventListeners();
	setupProjectTransferListeners();
	setupChartActionListeners();
	setupGlobalKeyboardListeners();
	setupDatasetListeners();
}
