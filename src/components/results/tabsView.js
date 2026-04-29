import { t } from '../../services/i18nService.js';
import { countGlobalFilterRules, isGlobalFilterActive } from '../../utils/globalFilter.js';

let listenersRegistered = false;
let currentOnChartConfigChange = null;
let currentOnGlobalFilterOpen = null;

function getTabElements() {
	return {
		tabPreview: document.getElementById('tab-preview'),
		tabCharts: document.getElementById('tab-charts'),
		tabPanel: document.getElementById('tab-panel'),
		previewPanel: document.getElementById('painel-preview'),
		chartsPanel: document.getElementById('painel-charts'),
		dashboardPanel: document.getElementById('painel-panel'),
		globalFilterTrigger: document.getElementById('btn-global-filter'),
		globalFilterLabel: document.getElementById('global-filter-trigger-label'),
		globalFilterBadge: document.getElementById('global-filter-trigger-badge'),
	};
}

export function setupTabListeners(onChartConfigChange, onGlobalFilterOpen) {
	currentOnChartConfigChange = onChartConfigChange || null;
	currentOnGlobalFilterOpen = onGlobalFilterOpen || null;

	if (listenersRegistered) return;

	const { tabPreview, tabCharts, tabPanel, globalFilterTrigger } = getTabElements();
	if (!tabPreview || !tabCharts || !tabPanel) return;

	tabPreview.addEventListener('click', () => {
		if (!currentOnChartConfigChange) return;
		currentOnChartConfigChange({ aba: 'preview' });
	});

	tabCharts.addEventListener('click', () => {
		if (!currentOnChartConfigChange) return;
		currentOnChartConfigChange({ aba: 'charts' });
	});

	tabPanel.addEventListener('click', () => {
		if (!currentOnChartConfigChange) return;
		currentOnChartConfigChange({ aba: 'panel' });
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

export function updateTabsUI(activeTab) {
	const { tabPreview, tabCharts, tabPanel, previewPanel, chartsPanel, dashboardPanel } = getTabElements();
	if (!tabPreview || !tabCharts || !tabPanel || !previewPanel || !chartsPanel || !dashboardPanel) return;

	const previewActive = activeTab === 'preview';
	const chartsActive = activeTab === 'charts';
	const panelActive = activeTab === 'panel';

	tabPreview.classList.toggle('ativo', previewActive);
	tabCharts.classList.toggle('ativo', chartsActive);
	tabPanel.classList.toggle('ativo', panelActive);
	previewPanel.classList.toggle('ativo', previewActive);
	chartsPanel.classList.toggle('ativo', chartsActive);
	dashboardPanel.classList.toggle('ativo', panelActive);
}

export function updateGlobalFilterTrigger({
	activeTab,
	hasDataset,
	globalFilter,
	filteredCount,
	totalCount,
}) {
	const { globalFilterTrigger, globalFilterLabel, globalFilterBadge } = getTabElements();
	if (!globalFilterTrigger || !globalFilterLabel) return;

	const showOnCharts = activeTab === 'charts';
	globalFilterTrigger.hidden = !showOnCharts;

	if (!showOnCharts) {
		return;
	}

	const disabled = !hasDataset;
	globalFilterTrigger.disabled = disabled;
	globalFilterTrigger.setAttribute('aria-disabled', disabled ? 'true' : 'false');

	const active = hasDataset && isGlobalFilterActive(globalFilter);
	globalFilterTrigger.dataset.active = active ? 'true' : 'false';
	globalFilterTrigger.classList.toggle('ativo', active);

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

export function updateTabs(activeTab, onChartConfigChange, _configIgnored, options = {}) {
	setupTabListeners(onChartConfigChange, options.onGlobalFilterOpen);
	updateTabsUI(activeTab);
	if (options.triggerState) {
		updateGlobalFilterTrigger({ activeTab, ...options.triggerState });
	}
}