import { t, getLocale } from '../../services/i18nService.js';
<<<<<<< HEAD
import { renderBarChart, renderNetworkGraph, renderPieChart, renderScatterPlot, renderTreeMap } from '../../modules/visualizations/index.js';
=======
import { renderBarChart, renderBubbleChart, renderNetworkGraph, renderPieChart, renderScatterPlot } from '../../modules/visualizations/index.js';
>>>>>>> aaf62f6646e93c88a51408877c51ad22a7e30d83
import { mergeChartConfigWithDefaults } from '../../config/chartDefaults.js';
import { applyChartFilterRows } from '../../utils/chartFilters.js';
import { CHART_CONTAINERS, CHART_BLOCKS, VIEW_IDS, BADGE_IDS } from '../../config/elementIds.js';

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
<<<<<<< HEAD
	const chartsGrid = document.getElementById('charts-grid');
	const emptyState = document.getElementById('charts-empty-state');
	const blocoBar = document.getElementById('chart-block-bar');
	const blocoScatter = document.getElementById('chart-block-scatter');
	const blocoNetwork = document.getElementById('chart-block-network');
	const blocoPie = document.getElementById('chart-block-pie');
	const blocoTreemap = document.getElementById('chart-block-treemap');
=======
	const chartsGrid = document.getElementById(VIEW_IDS.chartsGrid);
	const emptyState = document.getElementById(VIEW_IDS.chartsEmptyState);
	const blocoBar = document.getElementById(CHART_BLOCKS.bar);
	const blocoScatter = document.getElementById(CHART_BLOCKS.scatter);
	const blocoNetwork = document.getElementById(CHART_BLOCKS.network);
	const blocoPie = document.getElementById(CHART_BLOCKS.pie);
	const blocoBubble = document.getElementById(CHART_BLOCKS.bubble);
>>>>>>> aaf62f6646e93c88a51408877c51ad22a7e30d83

	document.getElementById(BADGE_IDS.charts).textContent = t(
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
<<<<<<< HEAD
		blocoTreemap.style.display = 'block';
		document.getElementById('chart-bar-container').innerHTML = '';
		document.getElementById('chart-scatter-container').innerHTML = '';
		document.getElementById('chart-network-container').innerHTML = '';
		document.getElementById('chart-pie-container').innerHTML = '';
		document.getElementById('chart-treemap-container').innerHTML = '';
		return;
	}

	if (!chartConfig.bar.enabled && !chartConfig.scatter.enabled && !chartConfig.network.enabled && !chartConfig.pie.enabled && !chartConfig.treemap.enabled) {
=======
		blocoBubble.style.display = 'block';
		document.getElementById(CHART_CONTAINERS.bar).innerHTML = '';
		document.getElementById(CHART_CONTAINERS.scatter).innerHTML = '';
		document.getElementById(CHART_CONTAINERS.network).innerHTML = '';
		document.getElementById(CHART_CONTAINERS.pie).innerHTML = '';
		document.getElementById(CHART_CONTAINERS.bubble).innerHTML = '';
		return;
	}

	if (!chartConfig.bar.enabled && !chartConfig.scatter.enabled && !chartConfig.network.enabled && !chartConfig.pie.enabled && !chartConfig.bubble.enabled) {
>>>>>>> aaf62f6646e93c88a51408877c51ad22a7e30d83
		chartsGrid.style.display = 'none';
		emptyState.style.display = 'flex';
		emptyState.textContent = t('chive-chart-empty-none');
		blocoBar.style.display = 'none';
		blocoScatter.style.display = 'none';
		blocoNetwork.style.display = 'none';
		blocoPie.style.display = 'none';
<<<<<<< HEAD
		blocoTreemap.style.display = 'none';
		document.getElementById('chart-bar-container').innerHTML = '';
		document.getElementById('chart-scatter-container').innerHTML = '';
		document.getElementById('chart-network-container').innerHTML = '';
		document.getElementById('chart-pie-container').innerHTML = '';
		document.getElementById('chart-treemap-container').innerHTML = '';
=======
		blocoBubble.style.display = 'none';
		document.getElementById(CHART_CONTAINERS.bar).innerHTML = '';
		document.getElementById(CHART_CONTAINERS.scatter).innerHTML = '';
		document.getElementById(CHART_CONTAINERS.network).innerHTML = '';
		document.getElementById(CHART_CONTAINERS.pie).innerHTML = '';
		document.getElementById(CHART_CONTAINERS.bubble).innerHTML = '';
>>>>>>> aaf62f6646e93c88a51408877c51ad22a7e30d83
		return;
	}

	chartsGrid.style.display = 'grid';
	emptyState.style.display = 'none';

	if (chartConfig.bar.enabled) {
		blocoBar.style.display = 'block';
		document.getElementById(CHART_CONTAINERS.bar).style.minHeight = `${Number(chartConfig.bar.chartHeight || 320)}px`;
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
			document.getElementById(CHART_CONTAINERS.bar),
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
			showChartMessage(CHART_CONTAINERS.bar, t(chave));
		}
	} else {
		blocoBar.style.display = 'none';
		document.getElementById(CHART_CONTAINERS.bar).innerHTML = '';
	}

	if (chartConfig.scatter.enabled) {
		blocoScatter.style.display = 'block';
		document.getElementById(CHART_CONTAINERS.scatter).style.minHeight = `${Number(chartConfig.scatter.chartHeight || 320)}px`;
		const scatterRows = applyChartFilterRows(rows, chartConfig.scatter.filter, numericColumnNames);
		const scatterResult = renderScatterPlot(
			document.getElementById(CHART_CONTAINERS.scatter),
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
			showChartMessage(CHART_CONTAINERS.scatter, t(chave));
		}
	} else {
		blocoScatter.style.display = 'none';
		document.getElementById(CHART_CONTAINERS.scatter).innerHTML = '';
	}

	if (chartConfig.network.enabled) {
		blocoNetwork.style.display = 'block';
		document.getElementById(CHART_CONTAINERS.network).style.minHeight = `${Number(chartConfig.network.chartHeight || 420)}px`;
		const networkRows = applyChartFilterRows(rows, chartConfig.network.filter, numericColumnNames);
		const networkResult = renderNetworkGraph(
			document.getElementById(CHART_CONTAINERS.network),
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
			showChartMessage(CHART_CONTAINERS.network, t('chive-chart-empty-network'));
		}
	} else {
		blocoNetwork.style.display = 'none';
		document.getElementById(CHART_CONTAINERS.network).innerHTML = '';
	}

	if (chartConfig.pie.enabled) {
		blocoPie.style.display = 'block';
		document.getElementById(CHART_CONTAINERS.pie).style.minHeight = `${Number(chartConfig.pie.chartHeight || 360)}px`;
		const pieRows = applyChartFilterRows(rows, chartConfig.pie.filter, numericColumnNames);
		const pieResult = renderPieChart(
			document.getElementById(CHART_CONTAINERS.pie),
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
			showChartMessage(CHART_CONTAINERS.pie, t(chave));
		}
	} else {
		blocoPie.style.display = 'none';
		document.getElementById(CHART_CONTAINERS.pie).innerHTML = '';
	}

	if (chartConfig.bubble.enabled) {
		blocoBubble.style.display = 'block';
		document.getElementById(CHART_CONTAINERS.bubble).style.minHeight = `${Number(chartConfig.bubble.chartHeight || 700)}px`;
		const bubbleRows = applyChartFilterRows(rows, chartConfig.bubble.filter, numericColumnNames);
		const bubbleMeasureMode = ['count', 'sum', 'mean'].includes(chartConfig.bubble.measureMode)
			? chartConfig.bubble.measureMode
			: 'count';
		const bubbleResult = renderBubbleChart(
			document.getElementById(CHART_CONTAINERS.bubble),
			bubbleRows,
			chartConfig.bubble.category,
			{
				customTitle: chartConfig.bubble.customTitle,
				chartHeight: chartConfig.bubble.chartHeight,
				topN: chartConfig.bubble.topN,
				measureMode: bubbleMeasureMode,
				valueColumn: chartConfig.bubble.valueColumn,
				nestingColumns: chartConfig.bubble.nestingColumns,
				groupColumn: chartConfig.bubble.groupColumn,
				nestingMode: chartConfig.bubble.nestingMode,
				padding: chartConfig.bubble.padding,
				labelMode: chartConfig.bubble.labelMode,
				colorScheme: chartConfig.bubble.colorScheme,
				locale: getLocale(),
				labels: {
					categoria: t('chive-chart-control-bubble-category'),
					contagem: t('chive-tooltip-count'),
					soma: t('chive-tooltip-sum'),
					media: t('chive-tooltip-mean'),
					grupo: t('chive-chart-control-bubble-group'),
					filhos: t('chive-chart-control-bubble-node-children-count'),
					nivel: t('chive-chart-control-bubble-node-depth'),
				},
			}
		);

		if (!bubbleResult.ok) {
			const chave = bubbleResult.reason === 'no-value-column' || bubbleResult.reason === 'no-numeric'
				? 'chive-chart-empty-bubble-numeric'
				: bubbleResult.reason === 'no-nesting-columns' || bubbleResult.reason === 'no-group-column'
					? 'chive-chart-empty-bubble-nesting-required'
					: 'chive-chart-empty-bubble';
			showChartMessage(CHART_CONTAINERS.bubble, t(chave));
		}
	} else {
		blocoBubble.style.display = 'none';
		document.getElementById(CHART_CONTAINERS.bubble).innerHTML = '';
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
