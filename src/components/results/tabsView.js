let listenersRegistered = false;
let currentOnChartConfigChange = null;

function getTabElements() {
	return {
		tabPreview: document.getElementById('tab-preview'),
		tabCharts: document.getElementById('tab-charts'),
		tabPanel: document.getElementById('tab-panel'),
		previewPanel: document.getElementById('painel-preview'),
		chartsPanel: document.getElementById('painel-charts'),
		dashboardPanel: document.getElementById('painel-panel'),
	};
}

export function setupTabListeners(onChartConfigChange) {
	currentOnChartConfigChange = onChartConfigChange || null;

	if (listenersRegistered) return;

	const { tabPreview, tabCharts, tabPanel } = getTabElements();
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

export function updateTabs(activeTab, onChartConfigChange) {
	setupTabListeners(onChartConfigChange);
	updateTabsUI(activeTab);
}
