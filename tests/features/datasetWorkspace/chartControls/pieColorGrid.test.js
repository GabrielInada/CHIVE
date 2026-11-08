// @vitest-environment jsdom

// The pie color grid and the drawn pie, through the same wiring the app uses:
// one shown dataset, the charts view and the controls sidebar, with the real
// registries and pie package. Only i18n is replaced.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/services/i18nService.js', () => ({
	t: key => key,
	getLocale: () => 'en',
}));

import { renderCharts } from '../../../../src/features/datasetWorkspace/views/chartsView.js';
import { renderChartControlsSidebar } from '../../../../src/features/datasetWorkspace/chartControls/chartControlsController.js';
import { deriveShownDataset } from '../../../../src/domain/datasets/shownDataset.js';
import { canonicalizeChartConfig } from '../../../../src/domain/charts/chartConfig.js';
import { CHART_BLOCKS, CHART_CONTAINERS } from '../../../../src/charts/workspaceDomIds.js';
import { VIEW_IDS, BADGE_IDS } from '../../../../src/features/datasetWorkspace/domIds.js';
import { CHART_TYPE_KEYS } from '../../../../src/config/charts/definitions.js';

const COLUMNS = [{ name: 'region', type: 'text' }, { name: 'sales', type: 'number' }];
// North leads the pie over every row. A filter that hides it moves South and
// East up a shade on the drawn chart.
const ROWS = ['North', 'North', 'North', 'South', 'South', 'East'].map(region => ({ region, sales: 1 }));
const HIDE_NORTH = {
	rules: [{ column: 'region', mode: 'categorical', include: [], exclude: ['v:North'] }],
	combine: 'AND',
};
const NEUTRAL_SWATCH = '#999999';

function setupDom() {
	document.body.innerHTML = '<div id="viz-chart-params"></div><div id="sidebar-panel-viz"></div>';
	for (const id of [VIEW_IDS.chartsGrid, VIEW_IDS.chartsEmptyState, BADGE_IDS.charts]) {
		const element = document.createElement('div');
		element.id = id;
		document.body.appendChild(element);
	}
	for (const type of CHART_TYPE_KEYS) {
		const block = document.createElement('div');
		block.id = CHART_BLOCKS[type];
		const container = document.createElement('div');
		container.id = CHART_CONTAINERS[type];
		block.appendChild(container);
		document.body.appendChild(block);
	}
}

function shownPie(pie = {}, globalFilter = undefined) {
	return deriveShownDataset({
		id: 'sales',
		name: 'sales.csv',
		rows: ROWS,
		columns: COLUMNS,
		selectedColumns: ['region', 'sales'],
		chartConfig: canonicalizeChartConfig({
			activeTab: 'charts',
			globalFilter,
			pie: { enabled: true, category: 'region', measureMode: 'count', ...pie },
		}, COLUMNS.map(column => column.name)),
	});
}

/** Fill of every drawn sector that is a category, by category key. */
function drawnFills() {
	return Object.fromEntries([...document.getElementById(CHART_CONTAINERS.pie).querySelectorAll('path')]
		.filter(path => path.__data__?.data && !path.__data__.data.isOther)
		.map(path => [path.__data__.data.key, path.getAttribute('fill').toLowerCase()]));
}

/** Swatch color of every grid entry, by category key. */
function swatches() {
	return Object.fromEntries([...document.querySelectorAll('input[data-color-grid-control="viz-pie-color-grid"]')]
		.map(input => [input.dataset.colorItem, input.value.toLowerCase()]));
}

function renderPieAndControls(shown) {
	renderCharts(shown);
	renderChartControlsSidebar(shown);
}

describe('pie color grid against the drawn pie', () => {
	beforeEach(setupDom);

	it('shows the fill of every sector the chart draws under the global filter', () => {
		renderPieAndControls(shownPie({}, HIDE_NORTH));

		const fills = drawnFills();
		const grid = swatches();
		expect(Object.keys(fills)).toEqual(['South', 'East']);
		expect(Object.keys(grid)).toEqual(['North', 'South', 'East']);
		for (const [key, fill] of Object.entries(fills)) {
			expect(grid[key], key).toBe(fill);
		}
		// The filter hides North, so the chart does not draw it.
		expect(grid.North).toBe(NEUTRAL_SWATCH);
	});

	it('agrees with the chart on Top-N and on custom slice colors', () => {
		renderPieAndControls(shownPie({ topN: 1, topNMode: 'other', customSliceColors: { East: '#123456' } }));

		const fills = drawnFills();
		const grid = swatches();
		expect(Object.keys(fills)).toEqual(['North']);
		expect(grid.North).toBe(fills.North);
		// South and East fall into the Other sector: East keeps its custom
		// color, South has none.
		expect(grid.East).toBe('#123456');
		expect(grid.South).toBe(NEUTRAL_SWATCH);
	});
});
