/**
 * Charts-tab controller.
 *
 * Decides which chart section to render (single-chart-at-a-time), applies
 * the global filter to rows, and dispatches to per-chart workspace sections.
 * When the active tab is not `'charts'` (or no chart type is enabled), clears
 * every container and shows the empty state.
 *
 * @typedef {import('../../types.js').ChartConfig} ChartConfig
 * @typedef {import('../../types.js').ColumnSpec} ColumnSpec
 */

import { t } from '../../services/i18nService.js';
import { mergeChartConfigWithDefaults } from '../../config/chartDefaults.js';
import { CHART_TYPE_KEYS } from '../../config/chartTypes.js';
import { applyGlobalFilterRules, resolveGlobalFilterForColumns } from '../../utils/globalFilter.js';
import { clearChartContainer } from '../../utils/chartContainerLifecycle.js';
import { CHART_CONTAINERS, CHART_BLOCKS, VIEW_IDS, BADGE_IDS } from '../../config/elementIds.js';
import { renderWorkspaceChart } from '../../charts/registries/workspace.js';

/**
 * Render the active chart into its container. Single-chart-at-a-time: if
 * the config has multiple enabled flags (legacy), the first one in
 * canonical order wins, the rest are coerced to disabled before render.
 *
 * The `options` callbacks all share the same `(column, token) => void`
 * signature and are wired into the per-chart tooltip actions.
 *
 * @param {Partial<ChartConfig>} config
 * @param {Array<Object<string, *>>} rows - Pre-filter rows; the global filter is applied inside.
 * @param {ColumnSpec[]} visibleColumns
 * @param {ColumnSpec[]} visibleNumericColumns
 * @param {Object} [options]
 * @param {(column: string, token: string) => void} [options.onAddToGlobalFilter]
 * @param {(column: string, token: string) => void} [options.onFocusGlobalFilter]
 * @param {(column: string, token: string) => void} [options.onExcludeGlobalFilter]
 * @param {(column: string, token: string) => void} [options.onRemoveFromGlobalFilter]
 * @param {(column: string, token: string) => void} [options.onBringBackGlobalFilter]
 * @param {(column: string, token: string) => 'included' | 'excluded' | null} [options.getTokenFilterState]
 * @param {(column: string, token: string) => boolean} [options.isShowOnlyThisRedundant]
 * @returns {void}
 */
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
		? visibleNumericColumns.map(column => column?.name).filter(Boolean)
		: [];
	const allColumnNames = Array.isArray(visibleColumns)
		? visibleColumns.map(column => column?.name).filter(Boolean)
		: [];
	const columnTypeByName = Array.isArray(visibleColumns)
		? Object.fromEntries(visibleColumns.map(column => [column?.name, column?.type]))
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
	const blocoScatter3d = document.getElementById(CHART_BLOCKS.scatter3d);

	document.getElementById(BADGE_IDS.charts).textContent = t(
		'chive-charts-badge',
		visibleColumns.length,
		visibleNumericColumns.length
	);

	if (chartConfig.activeTab !== 'charts') {
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
		if (blocoScatter3d) blocoScatter3d.style.display = 'block';
		clearChartContainer(document.getElementById(CHART_CONTAINERS.bar));
		clearChartContainer(document.getElementById(CHART_CONTAINERS.scatter));
		clearChartContainer(document.getElementById(CHART_CONTAINERS.network));
		clearChartContainer(document.getElementById(CHART_CONTAINERS.pie));
		clearChartContainer(document.getElementById(CHART_CONTAINERS.bubble));
		clearChartContainer(document.getElementById(CHART_CONTAINERS.treemap));
		clearChartContainer(document.getElementById(CHART_CONTAINERS.line));
		clearChartContainer(document.getElementById(CHART_CONTAINERS.tin));
		clearChartContainer(document.getElementById(CHART_CONTAINERS.scatter3d));
		return;
	}

	if (!CHART_TYPE_KEYS.some(type => chartConfig[type].enabled)) {
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
		if (blocoScatter3d) blocoScatter3d.style.display = 'none';
		clearChartContainer(document.getElementById(CHART_CONTAINERS.bar));
		clearChartContainer(document.getElementById(CHART_CONTAINERS.scatter));
		clearChartContainer(document.getElementById(CHART_CONTAINERS.network));
		clearChartContainer(document.getElementById(CHART_CONTAINERS.pie));
		clearChartContainer(document.getElementById(CHART_CONTAINERS.bubble));
		clearChartContainer(document.getElementById(CHART_CONTAINERS.treemap));
		clearChartContainer(document.getElementById(CHART_CONTAINERS.line));
		clearChartContainer(document.getElementById(CHART_CONTAINERS.tin));
		clearChartContainer(document.getElementById(CHART_CONTAINERS.scatter3d));
		return;
	}

	// Single-chart-at-a-time: only the first enabled type renders. Legacy
	// configs with multiple enabled flags converge to one on the next toggle.
	const activeChartType = CHART_TYPE_KEYS.find(type => chartConfig[type].enabled) || null;
	CHART_TYPE_KEYS.forEach(type => {
		if (type !== activeChartType) {
			chartConfig[type] = { ...chartConfig[type], enabled: false };
		}
	});

	chartsGrid.style.display = 'grid';
	emptyState.style.display = 'none';

	for (const type of CHART_TYPE_KEYS) {
		renderWorkspaceChart(type, {
			config: chartConfig[type],
			rows: filteredRows,
			columnTypeByName,
			filterCallbacks,
		});
	}
}
