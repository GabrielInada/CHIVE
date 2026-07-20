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

import { t } from '../../../services/i18nService.js';
import { mergeChartConfigWithDefaults } from '../../../domain/charts/chartConfig.js';
import { CHART_TYPE_KEYS } from '../../../config/charts/definitions.js';
import { applyGlobalFilterRules, resolveGlobalFilterForColumns } from '../../../domain/filters/globalFilter.js';
import { clearChartContainer } from '../../../charts/shared/containerLifecycle.js';
import { CHART_CONTAINERS, CHART_BLOCKS } from '../../../charts/workspaceDomIds.js';
import { renderWorkspaceChart } from '../../../charts/registries/workspace.js';
import { VIEW_IDS, BADGE_IDS } from '../domIds.js';

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
	const chartBlocks = CHART_TYPE_KEYS
		.map(type => document.getElementById(CHART_BLOCKS[type]))
		.filter(Boolean);
	const clearAllChartContainers = () => {
		for (const type of CHART_TYPE_KEYS) {
			clearChartContainer(document.getElementById(CHART_CONTAINERS[type]));
		}
	};

	document.getElementById(BADGE_IDS.charts).textContent = t(
		'chive-charts-badge',
		visibleColumns.length,
		visibleNumericColumns.length
	);

	if (chartConfig.activeTab !== 'charts') {
		chartsGrid.hidden = false;
		emptyState.hidden = true;
		chartBlocks.forEach(block => {
			block.hidden = false;
		});
		clearAllChartContainers();
		return;
	}

	if (!CHART_TYPE_KEYS.some(type => chartConfig[type].enabled)) {
		chartsGrid.hidden = true;
		emptyState.hidden = false;
		emptyState.textContent = t('chive-chart-empty-none');
		chartBlocks.forEach(block => {
			block.hidden = true;
		});
		clearAllChartContainers();
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

	chartsGrid.hidden = false;
	emptyState.hidden = true;

	for (const type of CHART_TYPE_KEYS) {
		renderWorkspaceChart(type, {
			config: chartConfig[type],
			rows: filteredRows,
			columnTypeByName,
			filterCallbacks,
		});
	}
}
