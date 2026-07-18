/**
 * Tabs view, preview / charts / dashboard switcher plus the global-filter
 * trigger button that shows on dataset-facing tabs.
 *
 * Listeners are wired exactly once (module-local flag); subsequent
 * `updateTabs` calls just swap the current callbacks. This avoids
 * accumulating duplicate listeners across re-renders.
 */

import { t } from '../../../services/i18nService.js';
import { countGlobalFilterRules, isGlobalFilterActive } from '../../../domain/filters/globalFilter.js';
import { TAB_CONTENT_IDS } from '../domIds.js';

let listenersRegistered = false;
let currentOnChartConfigChange = null;
let currentOnGlobalFilterOpen = null;

/** @private */
function getTabElements() {
	return {
		tabPreview: document.getElementById('tab-preview'),
		tabCharts: document.getElementById('tab-charts'),
		tabPanel: document.getElementById('tab-panel'),
		previewPanel: document.getElementById(TAB_CONTENT_IDS.preview),
		chartsPanel: document.getElementById(TAB_CONTENT_IDS.charts),
		dashboardPanel: document.getElementById(TAB_CONTENT_IDS.panel),
		globalFilterTrigger: document.getElementById('btn-global-filter'),
		globalFilterLabel: document.getElementById('global-filter-trigger-label'),
		globalFilterBadge: document.getElementById('global-filter-trigger-badge'),
	};
}

/**
 * Wire tab + global-filter button click handlers. Idempotent, listeners
 * are attached once, and subsequent calls only swap the currently-active
 * callbacks.
 *
 * @param {(partial: Object) => void} onChartConfigChange
 * @param {() => void} [onGlobalFilterOpen]
 * @returns {void}
 */
export function setupTabListeners(onChartConfigChange, onGlobalFilterOpen) {
	currentOnChartConfigChange = onChartConfigChange || null;
	currentOnGlobalFilterOpen = onGlobalFilterOpen || null;

	if (listenersRegistered) return;

	const { tabPreview, tabCharts, tabPanel, globalFilterTrigger } = getTabElements();
	if (!tabPreview || !tabCharts || !tabPanel) return;

	tabPreview.addEventListener('click', () => {
		if (!currentOnChartConfigChange) return;
		currentOnChartConfigChange({ activeTab: 'preview' });
	});

	tabCharts.addEventListener('click', () => {
		if (!currentOnChartConfigChange) return;
		currentOnChartConfigChange({ activeTab: 'charts' });
	});

	tabPanel.addEventListener('click', () => {
		if (!currentOnChartConfigChange) return;
		currentOnChartConfigChange({ activeTab: 'panel' });
	});

	if (globalFilterTrigger) {
		globalFilterTrigger.addEventListener('click', () => {
			if (globalFilterTrigger.disabled) return;
			if (!currentOnGlobalFilterOpen) return;
			currentOnGlobalFilterOpen();
		});
	}

	listenersRegistered = true;
}

/**
 * Apply the active-tab class to the right tab button + its panel. Hides
 * the other panels via the same toggle.
 *
 * @param {'preview' | 'charts' | 'panel'} activeTab
 * @returns {void}
 */
export function updateTabsUI(activeTab) {
	const { tabPreview, tabCharts, tabPanel, previewPanel, chartsPanel, dashboardPanel } = getTabElements();
	if (!tabPreview || !tabCharts || !tabPanel || !previewPanel || !chartsPanel || !dashboardPanel) return;

	const previewActive = activeTab === 'preview';
	const chartsActive = activeTab === 'charts';
	const panelActive = activeTab === 'panel';

	tabPreview.classList.toggle('active', previewActive);
	tabCharts.classList.toggle('active', chartsActive);
	tabPanel.classList.toggle('active', panelActive);
	previewPanel.classList.toggle('active', previewActive);
	chartsPanel.classList.toggle('active', chartsActive);
	dashboardPanel.classList.toggle('active', panelActive);
}

/**
 * Update the global-filter trigger button: visibility (preview/charts tabs),
 * disabled state, active-class, and the label/badge text that reflect
 * the current filter rule count and filtered-row counts.
 *
 * @param {Object} args
 * @param {'preview' | 'charts' | 'panel'} args.activeTab
 * @param {boolean} args.hasDataset
 * @param {Object} args.globalFilter
 * @param {number} args.filteredCount
 * @param {number} args.totalCount
 * @returns {void}
 */
export function updateGlobalFilterTrigger({
	activeTab,
	hasDataset,
	globalFilter,
	filteredCount,
	totalCount,
}) {
	const { globalFilterTrigger, globalFilterLabel, globalFilterBadge } = getTabElements();
	if (!globalFilterTrigger || !globalFilterLabel) return;

	const showOnDatasetTab = activeTab === 'preview' || activeTab === 'charts';
	globalFilterTrigger.hidden = !showOnDatasetTab;

	if (!showOnDatasetTab) {
		return;
	}

	const disabled = !hasDataset;
	globalFilterTrigger.disabled = disabled;
	globalFilterTrigger.setAttribute('aria-disabled', disabled ? 'true' : 'false');

	const active = hasDataset && isGlobalFilterActive(globalFilter);
	globalFilterTrigger.dataset.active = active ? 'true' : 'false';
	globalFilterTrigger.classList.toggle('active', active);

	if (active) {
		const count = countGlobalFilterRules(globalFilter);
		const shown = Number.isFinite(filteredCount) ? filteredCount : 0;
		const total = Number.isFinite(totalCount) ? totalCount : 0;
		globalFilterLabel.textContent = t('chive-global-filter-trigger-active', count, shown, total);
		if (globalFilterBadge) {
			globalFilterBadge.hidden = false;
			globalFilterBadge.textContent = String(count);
		}
	} else {
		globalFilterLabel.textContent = t('chive-global-filter-trigger-inactive');
		if (globalFilterBadge) {
			globalFilterBadge.hidden = true;
			globalFilterBadge.textContent = '';
		}
	}
}

/**
 * Public entry: combined `setupTabListeners` + `updateTabsUI` +
 * (optional) `updateGlobalFilterTrigger`. Called once per render of the
 * data interface.
 *
 * @param {'preview' | 'charts' | 'panel'} activeTab
 * @param {(partial: Object) => void} onChartConfigChange
 * @param {*} _configIgnored - Kept for backward signature compatibility.
 * @param {Object} [options]
 * @param {() => void} [options.onGlobalFilterOpen]
 * @param {{ hasDataset: boolean, globalFilter: Object, filteredCount: number, totalCount: number }} [options.triggerState]
 * @returns {void}
 */
export function updateTabs(activeTab, onChartConfigChange, _configIgnored, options = {}) {
	setupTabListeners(onChartConfigChange, options.onGlobalFilterOpen);
	updateTabsUI(activeTab);
	if (options.triggerState) {
		updateGlobalFilterTrigger({ activeTab, ...options.triggerState });
	}
}
