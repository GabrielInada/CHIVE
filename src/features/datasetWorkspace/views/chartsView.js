/**
 * Charts-tab controller.
 *
 * Draws the charts tab from the shown dataset: it decides which chart section
 * renders (single-chart-at-a-time), builds the global filter actions the
 * pinned tooltips offer, and hands every chart its input through the workspace
 * registry, which shows or hides each section. The full render and live
 * preview both call it, so they hand the charts the same inputs.
 * When the active tab is not `'charts'` (or no chart type is enabled), clears
 * every container and shows the empty state.
 *
 * @typedef {import('../../../types.js').ChartConfig} ChartConfig
 * @typedef {import('../../../types.js').ShownDataset} ShownDataset
 */

import { t } from '../../../services/i18nService.js';
import { getNumericColumns, getColumnCurrenciesByName } from '../../../domain/datasets/columns.js';
import { CHART_TYPE_KEYS } from '../../../config/charts/definitions.js';
import { clearChartContainer } from '../../../charts/shared/containerLifecycle.js';
import { CHART_CONTAINERS, CHART_BLOCKS } from '../../../charts/workspaceDomIds.js';
import { renderWorkspaceChart } from '../../../charts/registries/workspace.js';
import { VIEW_IDS, BADGE_IDS } from '../domIds.js';
import { createGlobalFilterActions } from '../filters/globalFilterActions.js';

/**
 * Render the shown dataset's active chart into its container. Only the active
 * chart draws: a legacy config with more than one chart enabled draws the
 * first in canonical order, and the others render as disabled. The stored
 * config is read, never changed.
 *
 * The pinned tooltips offer an action only when it has a callback, so
 * without `onDatasetConfigChange` they offer lookups but no filter actions.
 * Presentation supplies the text.
 *
 * @param {ShownDataset} shown
 * @param {((partial: Partial<ChartConfig>) => void) | null} [onDatasetConfigChange] - Receives the global filter a tooltip action produces.
 * @returns {void}
 */
export function renderCharts(shown, onDatasetConfigChange = null) {
	const { dataset, rows, filter, visibleColumns, columnTypeByName, activeChartType } = shown;
	const chartConfig = dataset.chartConfig;
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
		getNumericColumns(visibleColumns).length
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

	if (!activeChartType) {
		chartsGrid.hidden = true;
		emptyState.hidden = false;
		emptyState.textContent = t('chive-chart-empty-none');
		chartBlocks.forEach(block => {
			block.hidden = true;
		});
		clearAllChartContainers();
		return;
	}

	chartsGrid.hidden = false;
	emptyState.hidden = true;

	const filterCallbacks = createGlobalFilterActions({
		globalFilter: chartConfig.globalFilter,
		safeGlobalFilter: filter,
		allColumnNames: dataset.columns.map(column => column.name),
		onDatasetConfigChange,
	});

	for (const type of CHART_TYPE_KEYS) {
		const config = chartConfig[type];
		renderWorkspaceChart(type, {
			config: type === activeChartType || !config.enabled ? config : { ...config, enabled: false },
			rows,
			columnTypeByName,
			columnCurrencyByName: getColumnCurrenciesByName(dataset.columns),
			filterCallbacks,
		});
	}
}
