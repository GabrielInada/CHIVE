// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	renderScatterPlot: vi.fn(() => ({ ok: true })),
	t: vi.fn(key => key),
	getLocale: vi.fn(() => 'en'),
}));

vi.mock('../../../../src/modules/visualizations/scatterPlot.js', () => ({
	renderScatterPlot: mocks.renderScatterPlot,
}));

vi.mock('../../../../src/services/i18nService.js', () => ({
	t: mocks.t,
	getLocale: mocks.getLocale,
}));

import { renderScatterChartSection } from '../../../../src/components/datasetWorkspace/chartRenders/scatterChartSection.js';
import { CHART_BLOCKS, CHART_CONTAINERS } from '../../../../src/config/elementIds.js';

function setupDom() {
	document.body.innerHTML = '';
	const block = document.createElement('div');
	block.id = CHART_BLOCKS.scatter;
	const container = document.createElement('div');
	container.id = CHART_CONTAINERS.scatter;
	document.body.append(block, container);
	return { block, container };
}

function defaultConfig(overrides = {}) {
	return {
		enabled: true,
		x: 'age',
		y: 'salary',
		chartHeight: 320,
		xScale: 'linear',
		yScale: 'linear',
		radius: 4,
		opacity: 0.7,
		sizeMode: 'fixed',
		sizeField: null,
		sizeMin: 2,
		sizeMax: 12,
		color: '#4e79a7',
		colorMode: 'uniform',
		colorField: null,
		gradientMinColor: '#fff',
		gradientMaxColor: '#000',
		gradientDistribution: 'linear',
		colorScheme: 'Bold',
		categoricalPairMode: 'none',
		showXAxisLabel: true,
		showYAxisLabel: true,
		customTitle: '',
		...overrides,
	};
}

const filterCallbacks = { onAddToGlobalFilter: null };

describe('renderScatterChartSection', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.renderScatterPlot.mockReturnValue({ ok: true });
	});

	it('hides block and skips renderer when disabled', () => {
		const { block, container } = setupDom();
		container.appendChild(document.createElement('span'));

		renderScatterChartSection({
			config: defaultConfig({ enabled: false }),
			rows: [],
			columnTypeByName: {},
			filterCallbacks,
		});

		expect(block.style.display).toBe('none');
		expect(container.children.length).toBe(0);
		expect(mocks.renderScatterPlot).not.toHaveBeenCalled();
	});

	it('forwards columnTypeByName into axisTypes', () => {
		setupDom();
		renderScatterChartSection({
			config: defaultConfig({ x: 'age', y: 'salary' }),
			rows: [],
			columnTypeByName: { age: 'numerico', salary: 'numerico' },
			filterCallbacks,
		});

		expect(mocks.renderScatterPlot.mock.calls[0][4].axisTypes).toEqual({
			x: 'numerico',
			y: 'numerico',
		});
	});

	it('passes undefined axisType for columns not present in the map', () => {
		setupDom();
		renderScatterChartSection({
			config: defaultConfig({ x: 'missing', y: 'salary' }),
			rows: [],
			columnTypeByName: { salary: 'numerico' },
			filterCallbacks,
		});

		expect(mocks.renderScatterPlot.mock.calls[0][4].axisTypes.x).toBeUndefined();
		expect(mocks.renderScatterPlot.mock.calls[0][4].axisTypes.y).toBe('numerico');
	});

	it('falls back to default height and localized axis labels', () => {
		const { container } = setupDom();
		renderScatterChartSection({
			config: defaultConfig({ x: '', y: '', chartHeight: 0 }),
			rows: [],
			columnTypeByName: {},
			filterCallbacks,
		});

		const [, , , , opts] = mocks.renderScatterPlot.mock.calls[0];
		expect(container.style.minHeight).toBe('320px');
		expect(opts.axisLabels).toEqual({
			x: 'chive-chart-control-scatter-x',
			y: 'chive-chart-control-scatter-y',
		});
	});

	it('shows the log-specific empty-state when reason is log-no-positive', () => {
		const { container } = setupDom();
		mocks.renderScatterPlot.mockReturnValueOnce({ ok: false, reason: 'log-no-positive' });

		renderScatterChartSection({
			config: defaultConfig(),
			rows: [],
			columnTypeByName: {},
			filterCallbacks,
		});

		expect(container.querySelector('.chart-empty').textContent).toBe('chive-chart-empty-scatter-log');
	});

	it('shows the generic empty-state for any other failure reason', () => {
		const { container } = setupDom();
		mocks.renderScatterPlot.mockReturnValueOnce({ ok: false, reason: 'other' });

		renderScatterChartSection({
			config: defaultConfig(),
			rows: [],
			columnTypeByName: {},
			filterCallbacks,
		});

		expect(container.querySelector('.chart-empty').textContent).toBe('chive-chart-empty-scatter');
	});

	it('renders happy path with correct container, rows, and chart args', () => {
		const { block, container } = setupDom();
		const rows = [{ a: 1 }];

		renderScatterChartSection({
			config: defaultConfig({ chartHeight: 500 }),
			rows,
			columnTypeByName: {},
			filterCallbacks,
		});

		expect(block.style.display).toBe('block');
		expect(container.style.minHeight).toBe('500px');
		const [calledContainer, calledRows, x, y, opts] = mocks.renderScatterPlot.mock.calls[0];
		expect(calledContainer).toBe(container);
		expect(calledRows).toBe(rows);
		expect(x).toBe('age');
		expect(y).toBe('salary');
		expect(opts.filterCallbacks).toBe(filterCallbacks);
	});
});
