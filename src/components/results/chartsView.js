import { t } from '../../services/i18nService.js';
import { mergeChartConfigWithDefaults } from '../../config/chartDefaults.js';
import { applyGlobalFilterRules, resolveGlobalFilterForColumns } from '../../utils/globalFilter.js';
import { CHART_CONTAINERS, CHART_BLOCKS, VIEW_IDS, BADGE_IDS } from '../../config/elementIds.js';
import { renderBarChartSection } from './chartRenders/barChartSection.js';
import { renderLineChartSection } from './chartRenders/lineChartSection.js';
import { renderScatterChartSection } from './chartRenders/scatterChartSection.js';
import { renderPieChartSection } from './chartRenders/pieChartSection.js';
import { renderBubbleChartSection } from './chartRenders/bubbleChartSection.js';
import { renderNetworkChartSection } from './chartRenders/networkChartSection.js';
import { renderTreemapChartSection } from './chartRenders/treemapChartSection.js';
import { renderTinChartSection } from './chartRenders/tinChartSection.js';

export function renderCharts(config, rows, visibleColumns, visibleNumericColumns, options = {}) {
	const onAddToGlobalFilter = typeof options.onAddToGlobalFilter === 'function'
		? options.onAddToGlobalFilter
		: null;
	const onFocusGlobalFilter = typeof options.onFocusGlobalFilter === 'function'
		? options.onFocusGlobalFilter
		: null;
	const onExcludeGlobalFilter = typeof options.onExcludeGlobalFilter === 'function'
		? options.onExcludeGlobalFilter
		: null;
	const onRemoveFromGlobalFilter = typeof options.onRemoveFromGlobalFilter === 'function'
		? options.onRemoveFromGlobalFilter
		: null;
	const onBringBackGlobalFilter = typeof options.onBringBackGlobalFilter === 'function'
		? options.onBringBackGlobalFilter
		: null;
	const getTokenFilterState = typeof options.getTokenFilterState === 'function'
		? options.getTokenFilterState
		: null;
	const isShowOnlyThisRedundant = typeof options.isShowOnlyThisRedundant === 'function'
		? options.isShowOnlyThisRedundant
		: null;
	const filterActionLabels = {
		focus: t('chive-tooltip-show-only-this'),
		add: t('chive-tooltip-add-to-filter'),
		exclude: t('chive-tooltip-exclude'),
		remove: t('chive-tooltip-remove-from-filter'),
		bringBack: t('chive-tooltip-bring-back'),
		stateIncluded: t('chive-tooltip-state-included'),
		stateExcluded: t('chive-tooltip-state-excluded'),
		close: t('chive-tooltip-close'),
		filterBySource: t('chive-tooltip-filter-by-source'),
		filterByTarget: t('chive-tooltip-filter-by-target'),
	};
	const filterCallbacks = {
		onAddToGlobalFilter,
		onFocusGlobalFilter,
		onExcludeGlobalFilter,
		onRemoveFromGlobalFilter,
		onBringBackGlobalFilter,
		getTokenFilterState,
		isShowOnlyThisRedundant,
		filterActionLabels,
	};
	const chartConfig = mergeChartConfigWithDefaults(config);
	const numericColumnNames = Array.isArray(visibleNumericColumns)
		? visibleNumericColumns.map(column => column?.nome).filter(Boolean)
		: [];
	const allColumnNames = Array.isArray(visibleColumns)
		? visibleColumns.map(column => column?.nome).filter(Boolean)
		: [];
	const columnTypeByName = Array.isArray(visibleColumns)
		? Object.fromEntries(visibleColumns.map(column => [column?.nome, column?.tipo]))
		: {};
	const safeGlobalFilter = resolveGlobalFilterForColumns(chartConfig.globalFilter, allColumnNames);
	const filteredRows = applyGlobalFilterRules(rows, safeGlobalFilter, numericColumnNames);
	const chartsGrid = document.getElementById(VIEW_IDS.chartsGrid);
	const emptyState = document.getElementById(VIEW_IDS.chartsEmptyState);
	const blocoBar = document.getElementById(CHART_BLOCKS.bar);
	const blocoScatter = document.getElementById(CHART_BLOCKS.scatter);
	const blocoNetwork = document.getElementById(CHART_BLOCKS.network);
	const blocoPie = document.getElementById(CHART_BLOCKS.pie);
	const blocoBubble = document.getElementById(CHART_BLOCKS.bubble);
	const blocoTreemap = document.getElementById(CHART_BLOCKS.treemap);
	const blocoLine = document.getElementById(CHART_BLOCKS.line);
	const blocoTin = document.getElementById(CHART_BLOCKS.tin);

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
		blocoBubble.style.display = 'block';
		blocoTreemap.style.display = 'block';
		blocoLine.style.display = 'block';
		if (blocoTin) blocoTin.style.display = 'block';
		document.getElementById(CHART_CONTAINERS.bar).replaceChildren();
		document.getElementById(CHART_CONTAINERS.scatter).replaceChildren();
		document.getElementById(CHART_CONTAINERS.network).replaceChildren();
		document.getElementById(CHART_CONTAINERS.pie).replaceChildren();
		document.getElementById(CHART_CONTAINERS.bubble).replaceChildren();
		document.getElementById(CHART_CONTAINERS.treemap).replaceChildren();
		document.getElementById(CHART_CONTAINERS.line).replaceChildren();
		document.getElementById(CHART_CONTAINERS.tin)?.replaceChildren();
		return;
	}

	if (!chartConfig.bar.enabled && !chartConfig.scatter.enabled && !chartConfig.network.enabled && !chartConfig.pie.enabled && !chartConfig.bubble.enabled && !chartConfig.treemap.enabled && !chartConfig.line.enabled && !chartConfig.tin.enabled) {
		chartsGrid.style.display = 'none';
		emptyState.style.display = 'flex';
		emptyState.textContent = t('chive-chart-empty-none');
		blocoBar.style.display = 'none';
		blocoScatter.style.display = 'none';
		blocoNetwork.style.display = 'none';
		blocoPie.style.display = 'none';
		blocoBubble.style.display = 'none';
		blocoTreemap.style.display = 'none';
		blocoLine.style.display = 'none';
		if (blocoTin) blocoTin.style.display = 'none';
		document.getElementById(CHART_CONTAINERS.bar).replaceChildren();
		document.getElementById(CHART_CONTAINERS.scatter).replaceChildren();
		document.getElementById(CHART_CONTAINERS.network).replaceChildren();
		document.getElementById(CHART_CONTAINERS.pie).replaceChildren();
		document.getElementById(CHART_CONTAINERS.bubble).replaceChildren();
		document.getElementById(CHART_CONTAINERS.treemap).replaceChildren();
		document.getElementById(CHART_CONTAINERS.line).replaceChildren();
		document.getElementById(CHART_CONTAINERS.tin)?.replaceChildren();
		return;
	}

	// Single-chart-at-a-time: only the first enabled type renders. Legacy
	// configs with multiple enabled flags converge to one on the next toggle.
	const CHART_TYPE_ORDER = ['bar', 'line', 'scatter', 'pie', 'bubble', 'network', 'treemap', 'tin'];
	const activeChartType = CHART_TYPE_ORDER.find(type => chartConfig[type].enabled) || null;
	CHART_TYPE_ORDER.forEach(type => {
		if (type !== activeChartType) {
			chartConfig[type] = { ...chartConfig[type], enabled: false };
		}
	});

	chartsGrid.style.display = 'grid';
	emptyState.style.display = 'none';

	renderBarChartSection({ config: chartConfig.bar, rows: filteredRows, filterCallbacks });
	renderLineChartSection({ config: chartConfig.line, rows: filteredRows, columnTypeByName, filterCallbacks });
	renderScatterChartSection({ config: chartConfig.scatter, rows: filteredRows, columnTypeByName, filterCallbacks });
	renderPieChartSection({ config: chartConfig.pie, rows: filteredRows, filterCallbacks });
	renderBubbleChartSection({ config: chartConfig.bubble, rows: filteredRows, filterCallbacks });
	renderNetworkChartSection({ config: chartConfig.network, rows: filteredRows, filterCallbacks });
	renderTreemapChartSection({ config: chartConfig.treemap, rows: filteredRows, filterCallbacks });
	renderTinChartSection({ config: chartConfig.tin, rows: filteredRows });
}
