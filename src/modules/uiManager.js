/**
 * CHIVE UI Manager.
 *
 * Manages UI state:
 *   - Active tab switching (preview, charts, panel)
 *   - Sidebar mode (rows, viz, panel)
 *   - UI element visibility and states
 *
 * @typedef {import('../types.js').SidebarMode} SidebarMode
 * @typedef {'preview' | 'charts' | 'panel'} TabName
 */

import { t } from '../services/i18nService.js';
import { setSidebarMode } from './state/appState.js';

/**
 * Read the currently-active tab from the DOM (whichever `[data-tab]`
 * element carries the `active` class). Falls back to `'preview'` when no
 * tab is marked active.
 *
 * @returns {TabName}
 */
export function getActiveTab() {
	const tabs = document.querySelectorAll('[data-tab]');
	for (const tab of tabs) {
		if (tab.classList && tab.classList.contains('active')) {
			return tab.dataset.tab;
		}
	}
	return 'preview';
}

/**
 * Switch to a tab and apply the side-effect chain:
 *   1. Toggle `active`/`inactive` classes on `[data-tab]` buttons.
 *   2. Hide all `tab-content-*` panels except the one matching `tabName`.
 *   3. Update the sidebar mode to match (`preview → rows`, `charts → viz`, `panel → panel`) via `setSidebarMode`.
 *
 * No-op when `tabName` is not a valid tab name.
 *
 * @param {TabName} tabName
 * @fires STATE_EVENTS.SIDEBAR_MODE_CHANGED - Via `setSidebarMode` when the mode actually changes.
 */
export function switchTab(tabName) {
	const validTabs = ['preview', 'charts', 'panel'];
	if (!validTabs.includes(tabName)) {
		return;
	}

	// Update tab buttons
	const tabs = document.querySelectorAll('[data-tab]');
	tabs.forEach(tab => {
		if (tab.dataset.tab === tabName) {
			tab.classList.add('active');
			tab.classList.remove('inactive');
		} else {
			tab.classList.remove('active');
			tab.classList.add('inactive');
		}
	});

	// Update tab panels
	const painelPreview = document.getElementById('tab-content-preview');
	const painelCharts = document.getElementById('tab-content-charts');
	const painelPanel = document.getElementById('tab-content-dashboard');

	if (painelPreview) painelPreview.hidden = tabName !== 'preview';
	if (painelCharts) painelCharts.hidden = tabName !== 'charts';
	if (painelPanel) painelPanel.hidden = tabName !== 'panel';

	// Switch sidebar mode
	updateSidebarForTab(tabName);
}

/**
 * Map a tab name to its sidebar mode and apply the change.
 *
 * @private
 * @param {TabName} tabName
 */
function updateSidebarForTab(tabName) {
	const sidebarMap = {
		preview: 'data',
		charts: 'viz',
		panel: 'panel',
	};

	const newMode = sidebarMap[tabName] || 'data';
	setSidebarMode(newMode);
	updateSidebarUI(newMode);
}

/**
 * Apply a sidebar mode to the DOM by toggling `active`/`inactive` classes
 * on the three `sidebar-panel-*` containers. Pure DOM update — does not
 * write to state.
 *
 * @param {SidebarMode} mode
 */
export function updateSidebarUI(mode) {
	const sidebars = {
		data: document.getElementById('sidebar-panel-data'),
		viz: document.getElementById('sidebar-panel-viz'),
		panel: document.getElementById('sidebar-panel-dashboard'),
	};

	Object.entries(sidebars).forEach(([modeKey, el]) => {
		if (el) {
			el.classList.toggle('active', mode === modeKey);
			el.classList.toggle('inactive', mode !== modeKey);
		}
	});
}

/**
 * Show or hide a single tab panel without touching the active-tab state.
 *
 * @param {TabName} tabName
 * @param {boolean} visible
 */
export function setTabVisibility(tabName, visible) {
	const panelMap = {
		preview: document.getElementById('tab-content-preview'),
		charts: document.getElementById('tab-content-charts'),
		panel: document.getElementById('tab-content-dashboard'),
	};

	const panel = panelMap[tabName];
	if (panel) {
		panel.hidden = !visible;
	}
}

/**
 * Toggle the `sidebar-collapsed` class on `<body>` and update the toggle
 * button's `aria-expanded`, label, and visible chevron. No-op (returns
 * `false`) when the toggle button is missing from the DOM.
 *
 * @returns {boolean} The new collapsed state, or `false` when the button is missing.
 */
export function toggleSidebarCollapsed() {
	const toggleBtn = document.getElementById('btn-toggle-sidebar');
	
	if (toggleBtn) {
		const isCollapsed = document.body.classList.contains('sidebar-collapsed');
		const newCollapsedState = !isCollapsed;
		
		document.body.classList.toggle('sidebar-collapsed');

		// Update button accessibility and labels
		toggleBtn.setAttribute('aria-expanded', String(!newCollapsedState));
		const labelKey = newCollapsedState ? 'chive-sidebar-expand' : 'chive-sidebar-collapse';
		const label = t(labelKey);
		toggleBtn.setAttribute('aria-label', label);
		toggleBtn.setAttribute('title', label);
		toggleBtn.textContent = newCollapsedState ? '»' : '«';
		
		return newCollapsedState;
	}
	return false;
}

/**
 * Wire click handlers on every `[data-tab]` element so clicking a tab
 * delegates to {@link switchTab}. Called once during app boot from
 * `eventHandlers.initializeAllEventHandlers`.
 */
export function setupTabListeners() {
	const tabs = document.querySelectorAll('[data-tab]');
	tabs.forEach(tab => {
		tab.addEventListener('click', () => {
			const tabName = tab.dataset.tab;
			switchTab(tabName);
		});
	});
}

/**
 * Wire the click handler on the sidebar-toggle button to
 * {@link toggleSidebarCollapsed}. No-op when the button is absent.
 */
export function setupSidebarToggleListener() {
	const toggleBtn = document.getElementById('btn-toggle-sidebar');
	if (toggleBtn) {
		toggleBtn.addEventListener('click', toggleSidebarCollapsed);
	}
}
