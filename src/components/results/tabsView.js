export function atualizarTabs(abaAtiva, aoAlterarConfigGraficos, config) {
	const tabPreview = document.getElementById('tab-preview');
	const tabCharts = document.getElementById('tab-charts');
	const tabPanel = document.getElementById('tab-panel');
	const painelPreview = document.getElementById('painel-preview');
	const painelCharts = document.getElementById('painel-charts');
	const painelPanel = document.getElementById('painel-panel');
	const previewAtivo = abaAtiva === 'preview';
	const chartsAtivo = abaAtiva === 'charts';
	const panelAtivo = abaAtiva === 'panel';

	tabPreview.classList.toggle('ativo', previewAtivo);
	tabCharts.classList.toggle('ativo', chartsAtivo);
	tabPanel.classList.toggle('ativo', panelAtivo);
	painelPreview.classList.toggle('ativo', previewAtivo);
	painelCharts.classList.toggle('ativo', chartsAtivo);
	painelPanel.classList.toggle('ativo', panelAtivo);

	tabPreview.onclick = () => {
		if (!aoAlterarConfigGraficos) return;
		aoAlterarConfigGraficos({ ...config, aba: 'preview' });
	};

	tabCharts.onclick = () => {
		if (!aoAlterarConfigGraficos) return;
		aoAlterarConfigGraficos({ ...config, aba: 'charts' });
	};

	tabPanel.onclick = () => {
		if (!aoAlterarConfigGraficos) return;
		aoAlterarConfigGraficos({ ...config, aba: 'panel' });
	};
}
