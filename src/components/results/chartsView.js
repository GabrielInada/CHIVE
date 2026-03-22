import { t, obterLocale } from '../../services/i18nService.js';
import { renderBarChart, renderPieChart, renderScatterPlot } from '../../modules/visualizations/index.js';
import { mergeChartConfigWithDefaults } from '../../modules/chartConfigDefaults.js';

function mensagemChart(containerId, mensagem) {
	const container = document.getElementById(containerId);
	container.innerHTML = '';
	const vazio = document.createElement('div');
	vazio.className = 'chart-vazio';
	vazio.textContent = mensagem;
	container.appendChild(vazio);
}

export function renderizarGraficos(config, dados, colunasVisiveis, colunasNumericasVisiveis) {
	const chartConfig = mergeChartConfigWithDefaults(config);
	const chartsGrid = document.getElementById('charts-grid');
	const emptyState = document.getElementById('charts-empty-state');
	const blocoBar = document.getElementById('chart-block-bar');
	const blocoScatter = document.getElementById('chart-block-scatter');
	const blocoPie = document.getElementById('chart-block-pie');

	document.getElementById('badge-charts').textContent = t(
		'chive-charts-badge',
		colunasVisiveis.length,
		colunasNumericasVisiveis.length
	);

	if (chartConfig.aba !== 'charts') {
		chartsGrid.style.display = 'grid';
		emptyState.style.display = 'none';
		blocoBar.style.display = 'block';
		blocoScatter.style.display = 'block';
		blocoPie.style.display = 'block';
		document.getElementById('chart-bar-container').innerHTML = '';
		document.getElementById('chart-scatter-container').innerHTML = '';
		document.getElementById('chart-pie-container').innerHTML = '';
		return;
	}

	if (!chartConfig.bar.enabled && !chartConfig.scatter.enabled && !chartConfig.pie.enabled) {
		chartsGrid.style.display = 'none';
		emptyState.style.display = 'flex';
		emptyState.textContent = t('chive-chart-empty-none');
		blocoBar.style.display = 'none';
		blocoScatter.style.display = 'none';
		blocoPie.style.display = 'none';
		document.getElementById('chart-bar-container').innerHTML = '';
		document.getElementById('chart-scatter-container').innerHTML = '';
		document.getElementById('chart-pie-container').innerHTML = '';
		return;
	}

	chartsGrid.style.display = 'grid';
	emptyState.style.display = 'none';

	if (chartConfig.bar.enabled) {
		blocoBar.style.display = 'block';
		const barResult = renderBarChart(
			document.getElementById('chart-bar-container'),
			dados,
			chartConfig.bar.category,
			{
				ordenacao: chartConfig.bar.sort,
				topN: chartConfig.bar.topN,
				color: chartConfig.bar.color,
				showXAxisLabel: chartConfig.bar.showXAxisLabel,
				showYAxisLabel: chartConfig.bar.showYAxisLabel,
				axisLabels: {
					x: chartConfig.bar.category || t('chive-chart-control-bar-category'),
					y: t('chive-tooltip-count'),
				},
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

	if (chartConfig.scatter.enabled) {
		blocoScatter.style.display = 'block';
		const scatterResult = renderScatterPlot(
			document.getElementById('chart-scatter-container'),
			dados,
			chartConfig.scatter.x,
			chartConfig.scatter.y,
			{
				xScale: chartConfig.scatter.xScale,
				yScale: chartConfig.scatter.yScale,
				radius: chartConfig.scatter.radius,
				opacity: chartConfig.scatter.opacity,
				color: chartConfig.scatter.color,
				showXAxisLabel: chartConfig.scatter.showXAxisLabel,
				showYAxisLabel: chartConfig.scatter.showYAxisLabel,
				axisLabels: {
					x: chartConfig.scatter.x || t('chive-chart-control-scatter-x'),
					y: chartConfig.scatter.y || t('chive-chart-control-scatter-y'),
				},
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

	if (chartConfig.pie.enabled) {
		blocoPie.style.display = 'block';
		const pieResult = renderPieChart(
			document.getElementById('chart-pie-container'),
			dados,
			chartConfig.pie.category,
			{
				measureMode: chartConfig.pie.measureMode,
				valueColumn: chartConfig.pie.valueColumn,
				innerRadius: chartConfig.pie.innerRadius,
				outerRadius: chartConfig.pie.outerRadius,
				padAngle: chartConfig.pie.padAngle,
				color: chartConfig.pie.color,
				showCategoryLabel: chartConfig.pie.showCategoryLabel,
				showValueLabel: chartConfig.pie.showValueLabel,
				showLegend: chartConfig.pie.showLegend,
				labelPosition: chartConfig.pie.labelPosition,
				locale: obterLocale(),
				labels: {
					categoria: t('chive-chart-control-pie-category'),
					contagem: t('chive-tooltip-count'),
					percentual: t('chive-tooltip-percentage'),
				},
			}
		);

		if (!pieResult.ok) {
			const chave = pieResult.reason === 'sum-no-numeric'
				? 'chive-chart-empty-pie-sum'
				: 'chive-chart-empty-pie';
			mensagemChart('chart-pie-container', t(chave));
		}
	} else {
		blocoPie.style.display = 'none';
		document.getElementById('chart-pie-container').innerHTML = '';
	}
}
