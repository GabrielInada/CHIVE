/**
 * CHIVE UI Manager.
 *
 * Owns sidebar mode presentation and the collapsed sidebar control. Dataset
 * tab DOM and activation semantics belong exclusively to `tabsView.js`.
 *
 * @typedef {import('../types.js').SidebarMode} SidebarMode
 * @typedef {'preview' | 'charts' | 'panel'} TabName
 */

import { t } from '../services/i18nService.js';
import { setSidebarMode } from '../state/appState.js';

/**
 * Map a durable dataset tab to its sidebar mode and apply the change.
 *
 * @param {TabName} tabName
 */
export function syncSidebarToTab(tabName) {
	const sidebarMap = {
		preview: 'data',
		charts: 'viz',
		panel: 'panel',
	};

	if (!Object.prototype.hasOwnProperty.call(sidebarMap, tabName)) return;
	const newMode = sidebarMap[tabName];
	setSidebarMode(newMode);
	updateSidebarUI(newMode);
}

/**
 * Apply a sidebar mode to the DOM by toggling `active`/`inactive` classes
 * on the three `sidebar-panel-*` containers. Pure DOM update, does not
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
 * Toggle the sidebar button's `aria-expanded` state, label, and visible
 * chevron. CSS derives the presentation from that single accessible state.
 * No-op (returns `false`) when the toggle button is missing from the DOM.
 *
 * @returns {boolean} The new collapsed state, or `false` when the button is missing.
 */
export function toggleSidebarCollapsed() {
	const toggleBtn = document.getElementById('btn-toggle-sidebar');
	
	if (toggleBtn) {
		const isCollapsed = toggleBtn.getAttribute('aria-expanded') === 'false';
		const newCollapsedState = !isCollapsed;

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
 * Wire the click handler on the sidebar-toggle button to
 * {@link toggleSidebarCollapsed}. No-op when the button is absent.
 */
export function setupSidebarToggleListener() {
	const toggleBtn = document.getElementById('btn-toggle-sidebar');
	if (toggleBtn) {
		toggleBtn.addEventListener('click', toggleSidebarCollapsed);
	}
}
