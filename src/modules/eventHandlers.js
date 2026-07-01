/**
 * CHIVE Event Handlers orchestrator.
 *
 * The single composition point for application event listeners. It owns no
 * listener logic itself; each workflow lives in its own module under
 * `eventHandlers/`:
 *   - `eventHandlers/projectTransfer.js` (project export/import)
 *   - `eventHandlers/sidebarNavigation.js` (sidebar step buttons)
 *   - `eventHandlers/chartActions.js` (download SVG + add-to-panel)
 *   - `eventHandlers/keyboardShortcuts.js` (Ctrl/Cmd+O)
 *   - `eventHandlers/datasetActions.js` (delegated select/remove)
 *
 * File/tab/panel setup stays owned by fileManager, uiManager, and panelManager;
 * this module just wires them in boot order alongside the workflow setups.
 */

import { setupPanelEventListeners } from './panelManager.js';
import { setupFileInputListeners } from './fileManager.js';
import { setupTabListeners, setupSidebarToggleListener } from './uiManager.js';
import { setupProjectTransferListeners } from './eventHandlers/projectTransfer.js';
import { setupSidebarNavigationButtons } from './eventHandlers/sidebarNavigation.js';
import { setupChartActionListeners } from './eventHandlers/chartActions.js';
import { setupGlobalKeyboardListeners } from './eventHandlers/keyboardShortcuts.js';
import { setupDatasetListeners } from './eventHandlers/datasetActions.js';

/**
 * Wire all DOM listeners by calling each setup function in boot order:
 *   - `setupFileInputListeners` (fileManager)
 *   - `setupTabListeners` (uiManager)
 *   - `setupSidebarToggleListener` (uiManager)
 *   - `setupSidebarNavigationButtons` (eventHandlers/sidebarNavigation)
 *   - `setupPanelEventListeners` (panelManager)
 *   - `setupProjectTransferListeners` (eventHandlers/projectTransfer)
 *   - `setupChartActionListeners` (eventHandlers/chartActions)
 *   - `setupGlobalKeyboardListeners` (eventHandlers/keyboardShortcuts)
 *   - `setupDatasetListeners` (eventHandlers/datasetActions)
 *
 * Called once during app startup from `main.js`.
 */
export function initializeAllEventHandlers() {
	setupFileInputListeners();
	setupTabListeners();
	setupSidebarToggleListener();
	setupSidebarNavigationButtons();
	setupPanelEventListeners();
	setupProjectTransferListeners();
	setupChartActionListeners();
	setupGlobalKeyboardListeners();
	setupDatasetListeners();
}
