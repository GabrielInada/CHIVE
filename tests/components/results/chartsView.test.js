// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn((key, ...args) => (args.length ? `${key}:${args.join(',')}` : key)),
	mergeChartConfigWithDefaults: vi.fn(config => config),
	resolveGlobalFilterForColumns: vi.fn((filter) => filter),
	applyGlobalFilterRules: vi.fn((rows) => rows),
	renderBarChartSection: vi.fn(),
	renderLineChartSection: vi.fn(),
	renderScatterChartSection: vi.fn(),
	renderPieChartSection: vi.fn(),
	renderBubbleChartSection: vi.fn(),
	renderNetworkChartSection: vi.fn(),
	renderTreemapChartSection: vi.fn(),
	renderTinChartSection: vi.fn(),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

vi.mock('../../../src/config/chartDefaults.js', () => ({
	mergeChartConfigWithDefaults: mocks.mergeChartConfigWithDefaults,
}));

vi.mock('../../../src/utils/globalFilter.js', () => ({
	resolveGlobalFilterForColumns: mocks.resolveGlobalFilterForColumns,
	applyGlobalFilterRules: mocks.applyGlobalFilterRules,
}));

vi.mock('../../../src/components/results/chartRenders/barChartSection.js', () => ({
	renderBarChartSection: mocks.renderBarChartSection,
}));
vi.mock('../../../src/components/results/chartRenders/lineChartSection.js', () => ({
	renderLineChartSection: mocks.renderLineChartSection,
}));
vi.mock('../../../src/components/results/chartRenders/scatterChartSection.js', () => ({
	renderScatterChartSection: mocks.renderScatterChartSection,
}));
vi.mock('../../../src/components/results/chartRenders/pieChartSection.js', () => ({
	renderPieChartSection: mocks.renderPieChartSection,
}));
vi.mock('../../../src/components/results/chartRenders/bubbleChartSection.js', () => ({
	renderBubbleChartSection: mocks.renderBubbleChartSection,
}));
vi.mock('../../../src/components/results/chartRenders/networkChartSection.js', () => ({
	renderNetworkChartSection: mocks.renderNetworkChartSection,
}));
vi.mock('../../../src/components/results/chartRenders/treemapChartSection.js', () => ({
	renderTreemapChartSection: mocks.renderTreemapChartSection,
}));
vi.mock('../../../src/components/results/chartRenders/tinChartSection.js', () => ({
	renderTinChartSection: mocks.renderTinChartSection,
}));

import { renderCharts } from '../../../src/components/results/chartsView.js';
import { CHART_BLOCKS, CHART_CONTAINERS, VIEW_IDS, BADGE_IDS } from '../../../src/config/elementIds.js';

const CHART_TYPES = ['bar', 'scatter', 'network', 'pie', 'bubble', 'treemap', 'line', 'tin'];
const SECTION_MOCKS = {
	bar: 'renderBarChartSection',
	line: 'renderLineChartSection',
	scatter: 'renderScatterChartSection',
	pie: 'renderPieChartSection',
	bubble: 'renderBubbleChartSection',
	network: 'renderNetworkChartSection',
	treemap: 'renderTreemapChartSection',
	tin: 'renderTinChartSection',
};

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
	for (const type of CHART_TYPES) {
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
	};
	return { ...base, ...overrides };
}

describe('renderCharts orchestration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.mergeChartConfigWithDefaults.mockImplementation(config => config);
		mocks.resolveGlobalFilterForColumns.mockImplementation(filter => filter);
		mocks.applyGlobalFilterRules.mockImplementation(rows => rows);
	});

	it('resets all containers and shows all blocks when tab is not charts', () => {
		const { grid, emptyState, blocks, containers } = setupDom();
		containers.bar.appendChild(document.createElement('span'));

		renderCharts(makeConfig({ activeTab: 'preview' }), [], [], []);

		expect(grid.style.display).toBe('grid');
		expect(emptyState.style.display).toBe('none');
		for (const type of CHART_TYPES) {
			expect(blocks[type].style.display).toBe('block');
			expect(containers[type].children.length).toBe(0);
		}
		for (const key of Object.values(SECTION_MOCKS)) {
			expect(mocks[key]).not.toHaveBeenCalled();
		}
	});

	it('shows the empty-state and hides all blocks when no chart is enabled', () => {
		const { grid, emptyState, blocks, containers } = setupDom();

		renderCharts(makeConfig(), [], [], []);

		expect(grid.style.display).toBe('none');
		expect(emptyState.style.display).toBe('flex');
		expect(emptyState.textContent).toBe('chive-chart-empty-none');
		for (const type of CHART_TYPES) {
			expect(blocks[type].style.display).toBe('none');
			expect(containers[type].children.length).toBe(0);
		}
		for (const key of Object.values(SECTION_MOCKS)) {
			expect(mocks[key]).not.toHaveBeenCalled();
		}
	});

	it.each(CHART_TYPES)('dispatches to %s section helper when only %s is enabled', (type) => {
		setupDom();
		const config = makeConfig();
		config[type].enabled = true;

		renderCharts(config, [], [], []);

		const mockKey = SECTION_MOCKS[type];
		expect(mocks[mockKey]).toHaveBeenCalledTimes(1);
		const call = mocks[mockKey].mock.calls[0][0];
		expect(call.config.enabled).toBe(true);
		for (const other of CHART_TYPES) {
			if (other === type) continue;
			const otherCall = mocks[SECTION_MOCKS[other]].mock.calls[0][0];
			expect(otherCall.config.enabled).toBe(false);
		}
	});

	it('coerces multi-enabled config to the first chart in CHART_TYPE_ORDER', () => {
		setupDom();
		const config = makeConfig();
		config.bar.enabled = true;
		config.scatter.enabled = true;

		renderCharts(config, [], [], []);

		expect(mocks.renderBarChartSection.mock.calls[0][0].config.enabled).toBe(true);
		expect(mocks.renderScatterChartSection.mock.calls[0][0].config.enabled).toBe(false);
	});

	it('writes the i18n badge text using visible-column counts', () => {
		const { badge } = setupDom();
		const visibleColumns = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
		const visibleNumericColumns = [{ name: 'b' }];

		renderCharts(makeConfig(), [], visibleColumns, visibleNumericColumns);

		expect(badge.textContent).toBe('chive-charts-badge:3,1');
	});

	it('normalizes non-function callback options to null in filterCallbacks', () => {
		setupDom();
		const config = makeConfig();
		config.bar.enabled = true;

		renderCharts(config, [], [], [], {
			onAddToGlobalFilter: 'not a function',
			onFocusGlobalFilter: () => 'real',
		});

		const cb = mocks.renderBarChartSection.mock.calls[0][0].filterCallbacks;
		expect(cb.onAddToGlobalFilter).toBeNull();
		expect(typeof cb.onFocusGlobalFilter).toBe('function');
	});

	it('applies the global filter and forwards the filtered rows to each section', () => {
		setupDom();
		const rawRows = [{ a: 1 }, { a: 2 }, { a: 3 }];
		const filteredRows = [{ a: 1 }];
		mocks.applyGlobalFilterRules.mockReturnValueOnce(filteredRows);
		const config = makeConfig();
		config.bar.enabled = true;

		renderCharts(config, rawRows, [{ name: 'a' }], [{ name: 'a' }]);

		expect(mocks.applyGlobalFilterRules).toHaveBeenCalledTimes(1);
		const [calledRows, , numericNames] = mocks.applyGlobalFilterRules.mock.calls[0];
		expect(calledRows).toBe(rawRows);
		expect(numericNames).toEqual(['a']);
		expect(mocks.renderBarChartSection.mock.calls[0][0].rows).toBe(filteredRows);
	});
});
