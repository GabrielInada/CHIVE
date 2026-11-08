// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn((key, ...args) => (args.length ? `${key}:${args.join(',')}` : key)),
	mergeChartConfigWithDefaults: vi.fn(config => config),
	renderWorkspaceChart: vi.fn(() => true),
}));

vi.mock('../../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

vi.mock('../../../../src/domain/charts/chartConfig.js', () => ({
	mergeChartConfigWithDefaults: mocks.mergeChartConfigWithDefaults,
}));

vi.mock('../../../../src/charts/registries/workspace.js', () => ({
	renderWorkspaceChart: mocks.renderWorkspaceChart,
}));

import { renderCharts } from '../../../../src/features/datasetWorkspace/views/chartsView.js';
import { CHART_BLOCKS, CHART_CONTAINERS } from '../../../../src/charts/workspaceDomIds.js';
import { VIEW_IDS, BADGE_IDS } from '../../../../src/features/datasetWorkspace/domIds.js';
import { CHART_TYPE_KEYS } from '../../../../src/config/charts/definitions.js';

// The chart input each chart type was rendered with, by type.
function inputsByType() {
	return Object.fromEntries(mocks.renderWorkspaceChart.mock.calls);
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

function makeConfig(overrides = {}) {
	const base = {
		activeTab: 'charts',
		globalFilter: {},
		bar: { enabled: false, chartHeight: 320 },
		scatter: { enabled: false, chartHeight: 320 },
		network: { enabled: false, chartHeight: 420 },
		pie: { enabled: false, chartHeight: 360 },
		bubble: { enabled: false, chartHeight: 700 },
		treemap: { enabled: false, chartHeight: 380 },
		line: { enabled: false, chartHeight: 320 },
		tin: { enabled: false, chartHeight: 460 },
		scatter3d: { enabled: false, chartHeight: 460 },
	};
	return { ...base, ...overrides };
}

describe('renderCharts orchestration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.mergeChartConfigWithDefaults.mockImplementation(config => config);
	});

	it('resets all containers and shows all blocks when tab is not charts', () => {
		const { grid, emptyState, blocks, containers } = setupDom();
		containers.bar.appendChild(document.createElement('span'));

		renderCharts(makeConfig({ activeTab: 'preview' }), [], [], []);

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

		renderCharts(makeConfig(), [], [], []);

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
		const config = makeConfig();
		config[type].enabled = true;

		renderCharts(config, [], [], []);

		const inputs = inputsByType();
		expect(mocks.renderWorkspaceChart).toHaveBeenCalledTimes(CHART_TYPE_KEYS.length);
		for (const other of CHART_TYPE_KEYS) {
			expect(inputs[other].config.enabled).toBe(other === type);
		}
	});

	it('renders the chart sections in canonical chart order', () => {
		setupDom();
		const config = makeConfig();
		config.bar.enabled = true;

		renderCharts(config, [], [], []);

		expect(mocks.renderWorkspaceChart.mock.calls.map(([type]) => type)).toEqual(CHART_TYPE_KEYS);
	});

	it('coerces multi-enabled config to the first chart in canonical order', () => {
		setupDom();
		const config = makeConfig();
		config.bar.enabled = true;
		config.scatter.enabled = true;

		renderCharts(config, [], [], []);

		expect(inputsByType().bar.config.enabled).toBe(true);
		expect(inputsByType().scatter.config.enabled).toBe(false);
	});

	it('writes the i18n badge text using visible-column counts', () => {
		const { badge } = setupDom();
		const visibleColumns = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
		const visibleNumericColumns = [{ name: 'b' }];

		renderCharts(makeConfig(), [], visibleColumns, visibleNumericColumns);

		expect(badge.textContent).toBe('chive-charts-badge:3,1');
	});

	it('passes the filter callbacks on as they are', () => {
		setupDom();
		const config = makeConfig();
		config.bar.enabled = true;
		const callbacks = {
			onAddToGlobalFilter: vi.fn(),
			onFocusGlobalFilter: vi.fn(),
			onExcludeGlobalFilter: vi.fn(),
			onRemoveFromGlobalFilter: vi.fn(),
			onBringBackGlobalFilter: vi.fn(),
			getTokenFilterState: vi.fn(),
			isShowOnlyThisRedundant: vi.fn(),
		};

		renderCharts(config, [], [], [], callbacks);

		expect(inputsByType().bar.filterCallbacks).toBe(callbacks);
	});

	it('draws the rows it is given in each section, without filtering them again', () => {
		setupDom();
		const rows = [{ a: 1 }, { a: 2 }];
		const config = makeConfig({
			globalFilter: { rules: [{ column: 'a', mode: 'numeric', operator: 'gt', value: '1' }], combine: 'AND' },
		});
		config.bar.enabled = true;

		renderCharts(config, rows, [{ name: 'a' }], [{ name: 'a' }]);

		expect(inputsByType().bar.rows).toBe(rows);
	});
});
