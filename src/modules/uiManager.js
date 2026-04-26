/**
 * CHIVE UI Manager
 * 
 * Manages UI state:
 * - Active tab switching (preview, charts, panel)
 * - Sidebar mode (dados, viz, panel)
 * - UI element visibility and states
 */

import { t } from '../services/i18nService.js';
import { getSidebarMode, setSidebarMode } from './appState.js';

/**
 * Get active tab name from user selection
 * @returns {string} Tab name: 'preview', 'charts', or 'panel'
 */
export function getActiveTab() {
	const tabs = document.querySelectorAll('[data-aba]');
	for (const tab of tabs) {
		if (tab.classList && tab.classList.contains('ativo')) {
			return tab.dataset.aba;
		}
	}
	return 'preview';
}

/**
 * Switch to a tab and update UI
 * @param {string} tabName - Tab: 'preview', 'charts', or 'panel'
 */
export function switchTab(tabName) {
	const validTabs = ['preview', 'charts', 'panel'];
	if (!validTabs.includes(tabName)) {
		return;
	}

	// Update tab buttons
	const tabs = document.querySelectorAll('[data-aba]');
	tabs.forEach(tab => {
		if (tab.dataset.aba === tabName) {
			tab.classList.add('ativo');
			tab.classList.remove('inativo');
		} else {
			tab.classList.remove('ativo');
			tab.classList.add('inativo');
		}
	});

	// Update tab panels
	const painelPreview = document.getElementById('painel-preview');
	const painelCharts = document.getElementById('painel-charts');
	const painelPanel = document.getElementById('painel-panel');

	if (painelPreview) painelPreview.hidden = tabName !== 'preview';
	if (painelCharts) painelCharts.hidden = tabName !== 'charts';
	if (painelPanel) painelPanel.hidden = tabName !== 'panel';

	// Switch sidebar mode
	updateSidebarForTab(tabName);
}

/**
 * Update sidebar mode based on active tab
 * @private
 */
function updateSidebarForTab(tabName) {
	const sidebarMap = {
		preview: 'dados',
		charts: 'viz',
		panel: 'panel',
	};

	const newMode = sidebarMap[tabName] || 'dados';
	setSidebarMode(newMode);
	updateSidebarUI(newMode);
}

/**
 * Update sidebar visibility based on current mode
 * @private
 */
export function updateSidebarUI(mode) {
	const sidebars = {
		dados: document.getElementById('sidebar-panel-dados'),
		viz: document.getElementById('sidebar-panel-viz'),
		panel: document.getElementById('sidebar-panel-panel'),
	};

	Object.entries(sidebars).forEach(([modeKey, el]) => {
		if (el) {
			el.classList.toggle('ativo', mode === modeKey);
			el.classList.toggle('inativo', mode !== modeKey);
		}
	});
}

/**
 * Show/hide tab panel
 * @param {string} tabName - Tab name
 * @param {boolean} visible - Show or hide
 */
export function setTabVisibility(tabName, visible) {
	const panelMap = {
		preview: document.getElementById('painel-preview'),
		charts: document.getElementById('painel-charts'),
		panel: document.getElementById('painel-panel'),
	};

	const panel = panelMap[tabName];
	if (panel) {
		panel.hidden = !visible;
	}
}

/**
 * Toggle sidebar collapsed state
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
 * Setup tab click listeners
 * Called by main initialization
 */
export function setupTabListeners() {
	const tabs = document.querySelectorAll('[data-aba]');
	tabs.forEach(tab => {
		tab.addEventListener('click', () => {
			const tabName = tab.dataset.aba;
			switchTab(tabName);
		});
	});
}

/**
 * Setup sidebar toggle button listener
 */
export function setupSidebarToggleListener() {
	const toggleBtn = document.getElementById('btn-toggle-sidebar');
	if (toggleBtn) {
		toggleBtn.addEventListener('click', toggleSidebarCollapsed);
	}
}
