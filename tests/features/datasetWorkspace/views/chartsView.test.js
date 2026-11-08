// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn((key, ...args) => (args.length ? `${key}:${args.join(',')}` : key)),
	renderWorkspaceChart: vi.fn(() => true),
}));

vi.mock('../../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

vi.mock('../../../../src/charts/registries/workspace.js', () => ({
	renderWorkspaceChart: mocks.renderWorkspaceChart,
}));

import { renderCharts } from '../../../../src/features/datasetWorkspace/views/chartsView.js';
import { deriveShownDataset } from '../../../../src/domain/datasets/shownDataset.js';
import { canonicalizeChartConfig } from '../../../../src/domain/charts/chartConfig.js';
import { CHART_BLOCKS, CHART_CONTAINERS } from '../../../../src/charts/workspaceDomIds.js';
import { VIEW_IDS, BADGE_IDS } from '../../../../src/features/datasetWorkspace/domIds.js';
import { CHART_TYPE_KEYS } from '../../../../src/config/charts/definitions.js';

const COLUMNS = [
	{ name: 'region', type: 'text' },
	{ name: 'day', type: 'date' },
	{ name: 'sales', type: 'number' },
];
const ROWS = [
	{ region: 'A', day: '2024-01-01', sales: 1 },
	{ region: 'B', day: '2024-01-02', sales: 2 },
];

// The chart input each chart type was rendered with, by type.
function inputsByType() {
	return Object.fromEntries(mocks.renderWorkspaceChart.mock.calls);
}

/** A dataset as state stores it (canonical config), with `enabled` charts on. */
function makeDataset({ enabled = [], activeTab = 'charts', globalFilter, selectedColumns, config = {} } = {}) {
	const raw = { activeTab, globalFilter, ...config };
	for (const type of enabled) raw[type] = { ...raw[type], enabled: true };
	return {
		rows: ROWS,
		columns: COLUMNS,
		selectedColumns: selectedColumns ?? COLUMNS.map(column => column.name),
		chartConfig: canonicalizeChartConfig(raw, COLUMNS.map(column => column.name)),
	};
}

function setupDom() {
	document.body.innerHTML = '';
	const grid = document.createElement('div');
	grid.id = VIEW_IDS.chartsGrid;
	const emptyState = document.createElement('div');
	emptyState.id = VIEW_IDS.chartsEmptyState;
	const badge = document.createElement('div');
	badge.id = BADGE_IDS.charts;
	document.body.append(grid, emptyState, badge);
	const blocks = {};
	const containers = {};
	for (const type of CHART_TYPE_KEYS) {
		const block = document.createElement('div');
		block.id = CHART_BLOCKS[type];
		const container = document.createElement('div');
		container.id = CHART_CONTAINERS[type];
		document.body.append(block, container);
		blocks[type] = block;
		containers[type] = container;
	}
	return { grid, emptyState, badge, blocks, containers };
}

describe('renderCharts orchestration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('resets all containers and shows all blocks when tab is not charts', () => {
		const { grid, emptyState, blocks, containers } = setupDom();
		containers.bar.appendChild(document.createElement('span'));

		renderCharts(deriveShownDataset(makeDataset({ activeTab: 'preview', enabled: ['bar'] })));

		expect(grid.hidden).toBe(false);
		expect(emptyState.hidden).toBe(true);
		for (const type of CHART_TYPE_KEYS) {
			expect(blocks[type].hidden).toBe(false);
			expect(containers[type].children.length).toBe(0);
		}
		expect(mocks.renderWorkspaceChart).not.toHaveBeenCalled();
	});

	it('shows the empty-state and hides all blocks when no chart is enabled', () => {
		const { grid, emptyState, blocks, containers } = setupDom();

		renderCharts(deriveShownDataset(makeDataset()));

		expect(grid.hidden).toBe(true);
		expect(emptyState.hidden).toBe(false);
		expect(emptyState.textContent).toBe('chive-chart-empty-none');
		for (const type of CHART_TYPE_KEYS) {
			expect(blocks[type].hidden).toBe(true);
			expect(containers[type].children.length).toBe(0);
		}
		expect(mocks.renderWorkspaceChart).not.toHaveBeenCalled();
	});

	it.each(CHART_TYPE_KEYS)('renders every chart section with only %s enabled', (type) => {
		setupDom();
		const dataset = makeDataset({ enabled: [type] });

		renderCharts(deriveShownDataset(dataset));

		const inputs = inputsByType();
		expect(mocks.renderWorkspaceChart).toHaveBeenCalledTimes(CHART_TYPE_KEYS.length);
		for (const other of CHART_TYPE_KEYS) {
			expect(inputs[other].config).toEqual(expect.objectContaining({ enabled: other === type }));
		}
		// The active chart draws its stored config block as it is.
		expect(inputs[type].config).toBe(dataset.chartConfig[type]);
	});

	it('renders the chart sections in canonical chart order', () => {
		setupDom();

		renderCharts(deriveShownDataset(makeDataset({ enabled: ['bar'] })));

		expect(mocks.renderWorkspaceChart.mock.calls.map(([type]) => type)).toEqual(CHART_TYPE_KEYS);
	});

	it('draws only the first enabled chart of a legacy config, leaving the stored config alone', () => {
		setupDom();
		const dataset = makeDataset({ enabled: ['bar', 'scatter'] });

		renderCharts(deriveShownDataset(dataset));

		expect(inputsByType().bar.config.enabled).toBe(true);
		expect(inputsByType().scatter.config.enabled).toBe(false);
		expect(dataset.chartConfig.scatter.enabled).toBe(true);
	});

	it('writes the i18n badge text using visible-column counts', () => {
		const { badge } = setupDom();

		renderCharts(deriveShownDataset(makeDataset({ selectedColumns: ['region', 'sales'] })));

		expect(badge.textContent).toBe('chive-charts-badge:2,1');
	});

	it('draws the shown rows in each section, without filtering them again', () => {
		setupDom();
		const shown = deriveShownDataset(makeDataset({
			enabled: ['bar'],
			globalFilter: { rules: [{ column: 'sales', mode: 'numeric', operator: 'gt', value: '1' }], combine: 'AND' },
		}));

		renderCharts(shown);

		expect(shown.rows).toEqual([ROWS[1]]);
		expect(inputsByType().bar.rows).toBe(shown.rows);
	});

	it.each(['line', 'scatter'])('hands %s the type of an axis column the column list hides', type => {
		setupDom();
		const dataset = makeDataset({
			enabled: [type],
			selectedColumns: ['region', 'sales'],
			config: { [type]: { x: 'day', y: 'sales' } },
		});

		renderCharts(deriveShownDataset(dataset));

		expect(inputsByType()[type].columnTypeByName).toEqual({ region: 'text', day: 'date', sales: 'number' });
	});
});

describe('renderCharts tooltip filter actions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setupDom();
	});

	function filterCallbacks(dataset, onChartConfigChange) {
		renderCharts(deriveShownDataset(dataset), onChartConfigChange);
		return inputsByType().bar.filterCallbacks;
	}

	it('turns each tooltip action into a chart config change', () => {
		const onChartConfigChange = vi.fn();
		const dataset = makeDataset({
			enabled: ['bar'],
			globalFilter: {
				rules: [{ column: 'region', mode: 'categorical', include: ['v:A'], exclude: ['v:B'] }],
				combine: 'AND',
			},
		});

		const callbacks = filterCallbacks(dataset, onChartConfigChange);
		callbacks.onAddToGlobalFilter('region', 'v:C');
		callbacks.onFocusGlobalFilter('region', 'v:C');
		callbacks.onExcludeGlobalFilter('region', 'v:C');
		callbacks.onRemoveFromGlobalFilter('region', 'v:A');
		callbacks.onBringBackGlobalFilter('region', 'v:B');

		expect(onChartConfigChange).toHaveBeenCalledTimes(5);
		expect(onChartConfigChange.mock.calls[0][0].globalFilter.rules[0].include).toContain('v:C');
		expect(onChartConfigChange.mock.calls[1][0].globalFilter.rules[0]).toEqual(expect.objectContaining({
			column: 'region',
			include: ['v:C'],
		}));
		expect(onChartConfigChange.mock.calls[2][0].globalFilter.rules[0].exclude).toContain('v:C');
		expect(onChartConfigChange.mock.calls[3][0].globalFilter.rules[0].include).not.toContain('v:A');
		expect(onChartConfigChange.mock.calls[4][0].globalFilter.rules[0].exclude).not.toContain('v:B');
		expect(callbacks.getTokenFilterState('region', 'v:A')).toBe('included');
		expect(callbacks.isShowOnlyThisRedundant('region', 'v:A')).toBe(false);
	});

	it('ignores an action on a column the dataset lacks or with a non-string token', () => {
		const onChartConfigChange = vi.fn();

		const callbacks = filterCallbacks(makeDataset({ enabled: ['bar'] }), onChartConfigChange);
		callbacks.onAddToGlobalFilter('missing', 'v:A');
		callbacks.onFocusGlobalFilter('region', 42);
		callbacks.onExcludeGlobalFilter(42, 'v:A');
		callbacks.onRemoveFromGlobalFilter('missing', 'v:A');
		callbacks.onBringBackGlobalFilter('region', 42);

		expect(onChartConfigChange).not.toHaveBeenCalled();
	});

	// A hidden column is still a dataset column, so its categories stay filterable.
	it('filters by a column the column list hides', () => {
		const onChartConfigChange = vi.fn();

		const callbacks = filterCallbacks(makeDataset({ enabled: ['bar'], selectedColumns: ['sales'] }), onChartConfigChange);
		callbacks.onFocusGlobalFilter('region', 'v:A');

		expect(onChartConfigChange).toHaveBeenCalledTimes(1);
	});

	it('offers no actions without a callback, but still answers the lookups', () => {
		const callbacks = filterCallbacks(makeDataset({ enabled: ['bar'] }));

		expect(callbacks.onAddToGlobalFilter).toBeNull();
		expect(callbacks.onFocusGlobalFilter).toBeNull();
		expect(callbacks.getTokenFilterState('region', 'v:A')).toBeNull();
	});
});
