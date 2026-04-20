import { t, getLocale } from '../../services/i18nService.js';
import { renderBarChart, renderNetworkGraph, renderPieChart, renderScatterPlot, renderTreeMap } from '../../modules/visualizations/index.js';
import { mergeChartConfigWithDefaults } from '../../config/chartDefaults.js';
import { applyChartFilterRows } from '../../utils/chartFilters.js';

function showChartMessage(containerId, message) {
	const container = document.getElementById(containerId);
	container.innerHTML = '';
	const empty = document.createElement('div');
	empty.className = 'chart-vazio';
	empty.textContent = message;
	container.appendChild(empty);
}

export function renderCharts(config, rows, visibleColumns, visibleNumericColumns) {
	const chartConfig = mergeChartConfigWithDefaults(config);
	const numericColumnNames = Array.isArray(visibleNumericColumns)
		? visibleNumericColumns.map(column => column?.nome).filter(Boolean)
		: [];
	const chartsGrid = document.getElementById('charts-grid');
	const emptyState = document.getElementById('charts-empty-state');
	const blocoBar = document.getElementById('chart-block-bar');
	const blocoScatter = document.getElementById('chart-block-scatter');
	const blocoNetwork = document.getElementById('chart-block-network');
	const blocoPie = document.getElementById('chart-block-pie');
	const blocoTreemap = document.getElementById('chart-block-treemap');

	document.getElementById('badge-charts').textContent = t(
		'chive-charts-badge',
		visibleColumns.length,
		visibleNumericColumns.length
	);

	if (chartConfig.aba !== 'charts') {
		chartsGrid.style.display = 'grid';
		emptyState.style.display = 'none';
		blocoBar.style.display = 'block';
		blocoScatter.style.display = 'block';
		blocoNetwork.style.display = 'block';
		blocoPie.style.display = 'block';
		blocoTreemap.style.display = 'block';
		document.getElementById('chart-bar-container').innerHTML = '';
		document.getElementById('chart-scatter-container').innerHTML = '';
		document.getElementById('chart-network-container').innerHTML = '';
		document.getElementById('chart-pie-container').innerHTML = '';
		document.getElementById('chart-treemap-container').innerHTML = '';
		return;
	}

	if (!chartConfig.bar.enabled && !chartConfig.scatter.enabled && !chartConfig.network.enabled && !chartConfig.pie.enabled && !chartConfig.treemap.enabled) {
		chartsGrid.style.display = 'none';
		emptyState.style.display = 'flex';
		emptyState.textContent = t('chive-chart-empty-none');
		blocoBar.style.display = 'none';
		blocoScatter.style.display = 'none';
		blocoNetwork.style.display = 'none';
		blocoPie.style.display = 'none';
		blocoTreemap.style.display = 'none';
		document.getElementById('chart-bar-container').innerHTML = '';
		document.getElementById('chart-scatter-container').innerHTML = '';
		document.getElementById('chart-network-container').innerHTML = '';
		document.getElementById('chart-pie-container').innerHTML = '';
		document.getElementById('chart-treemap-container').innerHTML = '';
		return;
	}

	chartsGrid.style.display = 'grid';
	emptyState.style.display = 'none';

	if (chartConfig.bar.enabled) {
		blocoBar.style.display = 'block';
		document.getElementById('chart-bar-container').style.minHeight = `${Number(chartConfig.bar.chartHeight || 320)}px`;
		const barRows = applyChartFilterRows(rows, chartConfig.bar.filter, numericColumnNames);
		const barMeasureMode = ['count', 'sum', 'mean'].includes(chartConfig.bar.measureMode)
			? chartConfig.bar.measureMode
			: 'count';
		const barYAxisLabel = barMeasureMode === 'mean'
			? t('chive-tooltip-mean')
			: barMeasureMode === 'sum'
				? t('chive-tooltip-sum')
				: t('chive-tooltip-count');
		const barResult = renderBarChart(
			document.getElementById('chart-bar-container'),
			barRows,
			chartConfig.bar.category,
			{
				customTitle: chartConfig.bar.customTitle,
				chartHeight: chartConfig.bar.chartHeight,
				ordenacao: chartConfig.bar.sort,
				topN: chartConfig.bar.topN,
				color: chartConfig.bar.color,
				colorMode: chartConfig.bar.colorMode,
				gradientMinColor: chartConfig.bar.gradientMinColor,
				gradientMaxColor: chartConfig.bar.gradientMaxColor,
				manualThresholdPct: chartConfig.bar.manualThresholdPct,
				measureMode: barMeasureMode,
				valueColumn: chartConfig.bar.valueColumn,
				showXAxisLabel: chartConfig.bar.showXAxisLabel,
				showYAxisLabel: chartConfig.bar.showYAxisLabel,
				axisLabels: {
					x: chartConfig.bar.category || t('chive-chart-control-bar-category'),
					y: barYAxisLabel,
				},
				locale: getLocale(),
				labels: {
					categoria: t('chive-chart-control-bar-category'),
					contagem: t('chive-tooltip-count'),
					soma: t('chive-tooltip-sum'),
					media: t('chive-tooltip-mean'),
					percentual: t('chive-tooltip-percentage'),
				},
			}
		);
		if (!barResult.ok) {
			const chave = barResult.reason === 'no-numeric' || barResult.reason === 'no-value-column'
				? 'chive-chart-empty-bar-numeric'
				: 'chive-chart-empty-bar';
			showChartMessage('chart-bar-container', t(chave));
		}
	} else {
		blocoBar.style.display = 'none';
		document.getElementById('chart-bar-container').innerHTML = '';
	}

	if (chartConfig.scatter.enabled) {
		blocoScatter.style.display = 'block';
		document.getElementById('chart-scatter-container').style.minHeight = `${Number(chartConfig.scatter.chartHeight || 320)}px`;
		const scatterRows = applyChartFilterRows(rows, chartConfig.scatter.filter, numericColumnNames);
		const scatterResult = renderScatterPlot(
			document.getElementById('chart-scatter-container'),
			scatterRows,
			chartConfig.scatter.x,
			chartConfig.scatter.y,
			{
				customTitle: chartConfig.scatter.customTitle,
				chartHeight: chartConfig.scatter.chartHeight,
				xScale: chartConfig.scatter.xScale,
				yScale: chartConfig.scatter.yScale,
				radius: chartConfig.scatter.radius,
				opacity: chartConfig.scatter.opacity,
				color: chartConfig.scatter.color,
				colorMode: chartConfig.scatter.colorMode,
				colorField: chartConfig.scatter.colorField,
				gradientMinColor: chartConfig.scatter.gradientMinColor,
				gradientMaxColor: chartConfig.scatter.gradientMaxColor,
				colorScheme: chartConfig.scatter.colorScheme,
				showXAxisLabel: chartConfig.scatter.showXAxisLabel,
				showYAxisLabel: chartConfig.scatter.showYAxisLabel,
				axisLabels: {
					x: chartConfig.scatter.x || t('chive-chart-control-scatter-x'),
					y: chartConfig.scatter.y || t('chive-chart-control-scatter-y'),
				},
				locale: getLocale(),
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
			showChartMessage('chart-scatter-container', t(chave));
		}
	} else {
		blocoScatter.style.display = 'none';
		document.getElementById('chart-scatter-container').innerHTML = '';
	}

	if (chartConfig.network.enabled) {
		blocoNetwork.style.display = 'block';
		document.getElementById('chart-network-container').style.minHeight = `${Number(chartConfig.network.chartHeight || 420)}px`;
		const networkRows = applyChartFilterRows(rows, chartConfig.network.filter, numericColumnNames);
		const networkResult = renderNetworkGraph(
			document.getElementById('chart-network-container'),
			networkRows,
			chartConfig.network.source,
			chartConfig.network.target,
			{
				customTitle: chartConfig.network.customTitle,
				chartHeight: chartConfig.network.chartHeight,
				weightColumn: chartConfig.network.weight,
				groupColumn: chartConfig.network.group,
				nodeRadius: chartConfig.network.nodeRadius,
				linkDistance: chartConfig.network.linkDistance,
				chargeStrength: chartConfig.network.chargeStrength,
				linkOpacity: chartConfig.network.linkOpacity,
				showNodeLabels: chartConfig.network.showNodeLabels,
				sourceNodeColor: chartConfig.network.sourceNodeColor,
				targetNodeColor: chartConfig.network.targetNodeColor,
				edgeColorMode: chartConfig.network.edgeColorMode,
				zoomScale: chartConfig.network.zoomScale,
				alphaDecay: chartConfig.network.alphaDecay,
				showLegend: chartConfig.network.showLegend,
				locale: getLocale(),
				labels: {
					node: t('chive-chart-control-network-source'),
					linkWeight: t('chive-chart-control-network-weight'),
				},
			}
		);

		if (!networkResult.ok) {
			showChartMessage('chart-network-container', t('chive-chart-empty-network'));
		}
	} else {
		blocoNetwork.style.display = 'none';
		document.getElementById('chart-network-container').innerHTML = '';
	}

	if (chartConfig.pie.enabled) {
		blocoPie.style.display = 'block';
		document.getElementById('chart-pie-container').style.minHeight = `${Number(chartConfig.pie.chartHeight || 360)}px`;
		const pieRows = applyChartFilterRows(rows, chartConfig.pie.filter, numericColumnNames);
		const pieResult = renderPieChart(
			document.getElementById('chart-pie-container'),
			pieRows,
			chartConfig.pie.category,
			{
				customTitle: chartConfig.pie.customTitle,
				chartHeight: chartConfig.pie.chartHeight,
				measureMode: chartConfig.pie.measureMode,
				valueColumn: chartConfig.pie.valueColumn,
				innerRadius: chartConfig.pie.innerRadius,
				outerRadius: chartConfig.pie.outerRadius,
				padAngle: chartConfig.pie.padAngle,
				zoomScale: chartConfig.pie.zoomScale,
				color: chartConfig.pie.color,
				showCategoryLabel: chartConfig.pie.showCategoryLabel,
				showValueLabel: chartConfig.pie.showValueLabel,
				showLegend: chartConfig.pie.showLegend,
				labelPosition: chartConfig.pie.labelPosition,
								customSliceColors: chartConfig.pie.customSliceColors,
				locale: getLocale(),
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
			showChartMessage('chart-pie-container', t(chave));
		}
	} else {
		blocoPie.style.display = 'none';
		document.getElementById('chart-pie-container').innerHTML = '';
	}

	if (chartConfig.treemap.enabled) {
		blocoTreemap.style.display = 'block';
		document.getElementById('chart-treemap-container').style.minHeight = `${Number(chartConfig.treemap.chartHeight || 380)}px`;
		const treemapRows = applyChartFilterRows(rows, chartConfig.treemap.filter, numericColumnNames);
		const treemapResult = renderTreeMap(
			document.getElementById('chart-treemap-container'),
			treemapRows,
			chartConfig.treemap.category,
			{
				customTitle: chartConfig.treemap.customTitle,
				chartHeight: chartConfig.treemap.chartHeight,
				measureMode: chartConfig.treemap.measureMode,
				valueColumn: chartConfig.treemap.valueColumn,
				topN: chartConfig.treemap.topN,
				padding: chartConfig.treemap.padding,
				showLabels: chartConfig.treemap.showLabels,
				showValues: chartConfig.treemap.showValues,
				color: chartConfig.treemap.color,
				colorMode: chartConfig.treemap.colorMode,
				colorScheme: chartConfig.treemap.colorScheme,
				locale: getLocale(),
				labels: {
					categoria: t('chive-chart-control-treemap-category'),
					contagem: t('chive-tooltip-count'),
					soma: t('chive-tooltip-sum'),
					percentual: t('chive-tooltip-percentage'),
				},
			}
		);

		if (!treemapResult.ok) {
			const chave = treemapResult.reason === 'no-value-column'
				? 'chive-chart-empty-treemap-numeric'
				: 'chive-chart-empty-treemap';
			showChartMessage('chart-treemap-container', t(chave));
		}
	} else {
		blocoTreemap.style.display = 'none';
		document.getElementById('chart-treemap-container').innerHTML = '';
	}
}
