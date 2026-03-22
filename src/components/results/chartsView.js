import { t, obterLocale } from '../../services/i18nService.js';
import { renderBarChart, renderScatterPlot } from '../../modules/visualizations/index.js';

function mensagemChart(containerId, mensagem) {
	const container = document.getElementById(containerId);
	container.innerHTML = '';
	const vazio = document.createElement('div');
	vazio.className = 'chart-vazio';
	vazio.textContent = mensagem;
	container.appendChild(vazio);
}

export function renderizarGraficos(config, dados, colunasVisiveis, colunasNumericasVisiveis) {
	const chartsGrid = document.getElementById('charts-grid');
	const emptyState = document.getElementById('charts-empty-state');
	const blocoBar = document.getElementById('chart-block-bar');
	const blocoScatter = document.getElementById('chart-block-scatter');

	document.getElementById('badge-charts').textContent = t(
		'chive-charts-badge',
		colunasVisiveis.length,
		colunasNumericasVisiveis.length
	);

	if (config.aba !== 'charts') {
		chartsGrid.style.display = 'grid';
		emptyState.style.display = 'none';
		blocoBar.style.display = 'block';
		blocoScatter.style.display = 'block';
		document.getElementById('chart-bar-container').innerHTML = '';
		document.getElementById('chart-scatter-container').innerHTML = '';
		return;
	}

	if (!config.bar.enabled && !config.scatter.enabled) {
		chartsGrid.style.display = 'none';
		emptyState.style.display = 'flex';
		emptyState.textContent = t('chive-chart-empty-none');
		blocoBar.style.display = 'none';
		blocoScatter.style.display = 'none';
		document.getElementById('chart-bar-container').innerHTML = '';
		document.getElementById('chart-scatter-container').innerHTML = '';
		return;
	}

	chartsGrid.style.display = 'grid';
	emptyState.style.display = 'none';

	if (config.bar.enabled) {
		blocoBar.style.display = 'block';
		const barResult = renderBarChart(
			document.getElementById('chart-bar-container'),
			dados,
			config.bar.category,
			{
				ordenacao: config.bar.sort,
				topN: config.bar.topN,
				color: config.bar.color,
				locale: obterLocale(),
				labels: {
					categoria: t('chive-chart-control-bar-category'),
					contagem: t('chive-tooltip-count'),
					percentual: t('chive-tooltip-percentage'),
				},
			}
		);
		if (!barResult.ok) mensagemChart('chart-bar-container', t('chive-chart-empty-bar'));
	} else {
		blocoBar.style.display = 'none';
		document.getElementById('chart-bar-container').innerHTML = '';
	}

	if (config.scatter.enabled) {
		blocoScatter.style.display = 'block';
		const scatterResult = renderScatterPlot(
			document.getElementById('chart-scatter-container'),
			dados,
			config.scatter.x,
			config.scatter.y,
			{
				xScale: config.scatter.xScale,
				yScale: config.scatter.yScale,
				radius: config.scatter.radius,
				opacity: config.scatter.opacity,
				color: config.scatter.color,
				locale: obterLocale(),
				labels: {
					eixoX: t('chive-chart-control-scatter-x'),
					eixoY: t('chive-chart-control-scatter-y'),
					indice: t('chive-tooltip-row'),
				},
			}
		);
		if (!scatterResult.ok) {
			const chave = scatterResult.reason === 'log-no-positive'
				? 'chive-chart-empty-scatter-log'
				: 'chive-chart-empty-scatter';
			mensagemChart('chart-scatter-container', t(chave));
		}
	} else {
		blocoScatter.style.display = 'none';
		document.getElementById('chart-scatter-container').innerHTML = '';
	}
}
