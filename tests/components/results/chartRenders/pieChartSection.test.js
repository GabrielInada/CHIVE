// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	renderPieChart: vi.fn(() => ({ ok: true })),
	t: vi.fn(key => key),
	getLocale: vi.fn(() => 'en'),
}));

vi.mock('../../../../src/modules/visualizations/pieChart.js', () => ({
	renderPieChart: mocks.renderPieChart,
}));

vi.mock('../../../../src/services/i18nService.js', () => ({
	t: mocks.t,
	getLocale: mocks.getLocale,
}));

import { renderPieChartSection } from '../../../../src/components/results/chartRenders/pieChartSection.js';
import { CHART_BLOCKS, CHART_CONTAINERS } from '../../../../src/config/elementIds.js';

function setupDom() {
	document.body.innerHTML = '';
	const block = document.createElement('div');
	block.id = CHART_BLOCKS.pie;
	const container = document.createElement('div');
	container.id = CHART_CONTAINERS.pie;
	document.body.append(block, container);
	return { block, container };
}

function defaultConfig(overrides = {}) {
	return {
		enabled: true,
		category: 'region',
		measureMode: 'count',
		valueColumn: null,
		innerRadius: 0,
		outerRadius: 120,
		padAngle: 0.02,
		zoomScale: 1,
		topN: 0,
		topNMode: 'top',
		color: '#4e79a7',
		showCategoryLabel: true,
		showValueLabel: true,
		showLegend: true,
		labelPosition: 'outside',
		customSliceColors: { North: '#ff0000' },
		chartHeight: 360,
		customTitle: '',
		...overrides,
	};
}

const filterCallbacks = { onAddToGlobalFilter: null };

describe('renderPieChartSection', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.renderPieChart.mockReturnValue({ ok: true });
	});

	it('hides block and skips renderer when disabled', () => {
		const { block, container } = setupDom();
		container.appendChild(document.createElement('span'));

		renderPieChartSection({
			config: defaultConfig({ enabled: false }),
			rows: [],
			filterCallbacks,
		});

		expect(block.style.display).toBe('none');
		expect(container.children.length).toBe(0);
		expect(mocks.renderPieChart).not.toHaveBeenCalled();
	});

	it('passes customSliceColors through to the renderer', () => {
		setupDom();

		renderPieChartSection({
			config: defaultConfig({ customSliceColors: { A: '#abc', B: '#def' } }),
			rows: [],
			filterCallbacks,
		});

		expect(mocks.renderPieChart.mock.calls[0][3].customSliceColors).toEqual({ A: '#abc', B: '#def' });
	});

	it('shows the sum-specific empty-state when reason is sum-no-numeric', () => {
		const { container } = setupDom();
		mocks.renderPieChart.mockReturnValueOnce({ ok: false, reason: 'sum-no-numeric' });

		renderPieChartSection({
			config: defaultConfig(),
			rows: [],
			filterCallbacks,
		});

		expect(container.querySelector('.chart-empty').textContent).toBe('chive-chart-empty-pie-sum');
	});

	it('shows the generic empty-state for any other failure reason', () => {
		const { container } = setupDom();
		mocks.renderPieChart.mockReturnValueOnce({ ok: false, reason: 'other' });

		renderPieChartSection({
			config: defaultConfig(),
			rows: [],
			filterCallbacks,
		});

		expect(container.querySelector('.chart-empty').textContent).toBe('chive-chart-empty-pie');
	});

	it('renders happy path with chartHeight applied to container', () => {
		const { block, container } = setupDom();

		renderPieChartSection({
			config: defaultConfig({ chartHeight: 420 }),
			rows: [{ region: 'A' }],
			filterCallbacks,
		});

		expect(block.style.display).toBe('block');
		expect(container.style.minHeight).toBe('420px');
		expect(mocks.renderPieChart).toHaveBeenCalledTimes(1);
	});

	it('falls back to the default chart height', () => {
		const { container } = setupDom();

		renderPieChartSection({
			config: defaultConfig({ chartHeight: 0 }),
			rows: [],
			filterCallbacks,
		});

		expect(container.style.minHeight).toBe('360px');
	});
});
