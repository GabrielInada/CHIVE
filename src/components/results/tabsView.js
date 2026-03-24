export function updateTabs(activeTab, onChartConfigChange, config) {
	const tabPreview = document.getElementById('tab-preview');
	const tabCharts = document.getElementById('tab-charts');
	const tabPanel = document.getElementById('tab-panel');
	const previewPanel = document.getElementById('painel-preview');
	const chartsPanel = document.getElementById('painel-charts');
	const dashboardPanel = document.getElementById('painel-panel');
	const previewActive = activeTab === 'preview';
	const chartsActive = activeTab === 'charts';
	const panelActive = activeTab === 'panel';

	tabPreview.classList.toggle('ativo', previewActive);
	tabCharts.classList.toggle('ativo', chartsActive);
	tabPanel.classList.toggle('ativo', panelActive);
	previewPanel.classList.toggle('ativo', previewActive);
	chartsPanel.classList.toggle('ativo', chartsActive);
	dashboardPanel.classList.toggle('ativo', panelActive);

	tabPreview.onclick = () => {
		if (!onChartConfigChange) return;
		onChartConfigChange({ ...config, aba: 'preview' });
	};

	tabCharts.onclick = () => {
		if (!onChartConfigChange) return;
		onChartConfigChange({ ...config, aba: 'charts' });
	};

	tabPanel.onclick = () => {
		if (!onChartConfigChange) return;
		onChartConfigChange({ ...config, aba: 'panel' });
	};
}
