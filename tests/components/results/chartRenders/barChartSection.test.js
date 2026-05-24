// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	renderBarChart: vi.fn(() => ({ ok: true })),
	t: vi.fn(key => key),
	getLocale: vi.fn(() => 'en'),
}));

vi.mock('../../../../src/modules/visualizations/index.js', () => ({
	renderBarChart: mocks.renderBarChart,
}));

vi.mock('../../../../src/services/i18nService.js', () => ({
	t: mocks.t,
	getLocale: mocks.getLocale,
}));

import { renderBarChartSection } from '../../../../src/components/results/chartRenders/barChartSection.js';
import { CHART_BLOCKS, CHART_CONTAINERS } from '../../../../src/config/elementIds.js';

function setupDom() {
	document.body.innerHTML = '';
	const block = document.createElement('div');
	block.id = CHART_BLOCKS.bar;
	const container = document.createElement('div');
	container.id = CHART_CONTAINERS.bar;
	document.body.append(block, container);
	return { block, container };
}

function defaultConfig(overrides = {}) {
	return {
		enabled: true,
		category: 'region',
		chartHeight: 320,
		sort: 'desc',
		topN: 0,
		color: '#4e79a7',
		colorMode: 'uniform',
		gradientMinColor: '#ffffff',
		gradientMaxColor: '#000000',
		gradientDistribution: 'linear',
		manualThresholdPct: 50,
		measureMode: 'count',
		valueColumn: null,
		showXAxisLabel: true,
		showYAxisLabel: true,
		customTitle: '',
		...overrides,
	};
}

const filterCallbacks = { onAddToGlobalFilter: null };

describe('renderBarChartSection', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.renderBarChart.mockReturnValue({ ok: true });
	});

	it('hides block, clears container, and skips renderer when disabled', () => {
		const { block, container } = setupDom();
		container.appendChild(document.createElement('span'));

		renderBarChartSection({
			config: defaultConfig({ enabled: false }),
			rows: [],
			filterCallbacks,
		});

		expect(block.style.display).toBe('none');
		expect(container.children.length).toBe(0);
		expect(mocks.renderBarChart).not.toHaveBeenCalled();
	});

	it('renders the chart with normalized options when enabled', () => {
		const { block, container } = setupDom();
		const rows = [{ region: 'N' }, { region: 'S' }];

		renderBarChartSection({
			config: defaultConfig({ chartHeight: 400 }),
			rows,
			filterCallbacks,
		});

		expect(block.style.display).toBe('block');
		expect(container.style.minHeight).toBe('400px');
		expect(mocks.renderBarChart).toHaveBeenCalledTimes(1);
		const [calledContainer, calledRows, calledCategory, calledOpts] = mocks.renderBarChart.mock.calls[0];
		expect(calledContainer).toBe(container);
		expect(calledRows).toBe(rows);
		expect(calledCategory).toBe('region');
		expect(calledOpts.measureMode).toBe('count');
		expect(calledOpts.filterCallbacks).toBe(filterCallbacks);
		expect(calledOpts.locale).toBe('en');
	});

	it('coerces invalid measureMode to count', () => {
		setupDom();
		renderBarChartSection({
			config: defaultConfig({ measureMode: 'bogus' }),
			rows: [],
			filterCallbacks,
		});
		expect(mocks.renderBarChart.mock.calls[0][3].measureMode).toBe('count');
	});

	it('maps measureMode to the corresponding y-axis label', () => {
		setupDom();

		renderBarChartSection({ config: defaultConfig({ measureMode: 'sum' }), rows: [], filterCallbacks });
		expect(mocks.renderBarChart.mock.calls[0][3].axisLabels.y).toBe('chive-tooltip-sum');

		mocks.renderBarChart.mockClear();
		renderBarChartSection({ config: defaultConfig({ measureMode: 'mean' }), rows: [], filterCallbacks });
		expect(mocks.renderBarChart.mock.calls[0][3].axisLabels.y).toBe('chive-tooltip-mean');

		mocks.renderBarChart.mockClear();
		renderBarChartSection({ config: defaultConfig({ measureMode: 'count' }), rows: [], filterCallbacks });
		expect(mocks.renderBarChart.mock.calls[0][3].axisLabels.y).toBe('chive-tooltip-count');
	});

	it('shows the numeric-specific empty-state message when reason is no-numeric', () => {
		const { container } = setupDom();
		mocks.renderBarChart.mockReturnValueOnce({ ok: false, reason: 'no-numeric' });

		renderBarChartSection({ config: defaultConfig(), rows: [], filterCallbacks });

		const empty = container.querySelector('.chart-empty');
		expect(empty).not.toBeNull();
		expect(empty.textContent).toBe('chive-chart-empty-bar-numeric');
	});

	it('shows the same numeric-specific message when reason is no-value-column', () => {
		const { container } = setupDom();
		mocks.renderBarChart.mockReturnValueOnce({ ok: false, reason: 'no-value-column' });

		renderBarChartSection({ config: defaultConfig(), rows: [], filterCallbacks });

		expect(container.querySelector('.chart-empty').textContent).toBe('chive-chart-empty-bar-numeric');
	});

	it('shows the generic bar empty-state message for any other failure reason', () => {
		const { container } = setupDom();
		mocks.renderBarChart.mockReturnValueOnce({ ok: false, reason: 'something-else' });

		renderBarChartSection({ config: defaultConfig(), rows: [], filterCallbacks });

		expect(container.querySelector('.chart-empty').textContent).toBe('chive-chart-empty-bar');
	});
});
