// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	renderBubbleChart: vi.fn(() => ({ ok: true })),
	t: vi.fn(key => key),
	getLocale: vi.fn(() => 'en'),
}));

vi.mock('../../../../src/modules/visualizations/bubbleChart.js', () => ({
	renderBubbleChart: mocks.renderBubbleChart,
}));

vi.mock('../../../../src/services/i18nService.js', () => ({
	t: mocks.t,
	getLocale: mocks.getLocale,
}));

import { renderBubbleChartSection } from '../../../../src/components/datasetWorkspace/chartRenders/bubbleChartSection.js';
import { CHART_BLOCKS, CHART_CONTAINERS } from '../../../../src/config/elementIds.js';

function setupDom() {
	document.body.innerHTML = '';
	const block = document.createElement('div');
	block.id = CHART_BLOCKS.bubble;
	const container = document.createElement('div');
	container.id = CHART_CONTAINERS.bubble;
	document.body.append(block, container);
	return { block, container };
}

function defaultConfig(overrides = {}) {
	return {
		enabled: true,
		category: 'region',
		measureMode: 'count',
		valueColumn: null,
		nestingColumns: ['region'],
		groupColumn: 'group',
		nestingMode: 'auto',
		padding: 4,
		labelMode: 'always',
		colorScheme: 'Bold',
		topN: 0,
		chartHeight: 700,
		customTitle: '',
		...overrides,
	};
}

const filterCallbacks = { onAddToGlobalFilter: null };

describe('renderBubbleChartSection', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.renderBubbleChart.mockReturnValue({ ok: true });
	});

	it('hides block and skips renderer when disabled', () => {
		const { block, container } = setupDom();
		container.appendChild(document.createElement('span'));

		renderBubbleChartSection({
			config: defaultConfig({ enabled: false }),
			rows: [],
			filterCallbacks,
		});

		expect(block.style.display).toBe('none');
		expect(container.children.length).toBe(0);
		expect(mocks.renderBubbleChart).not.toHaveBeenCalled();
	});

	it('coerces invalid measureMode to count', () => {
		setupDom();
		renderBubbleChartSection({
			config: defaultConfig({ measureMode: 'invalid' }),
			rows: [],
			filterCallbacks,
		});
		expect(mocks.renderBubbleChart.mock.calls[0][3].measureMode).toBe('count');
	});

	it('maps no-numeric and no-value-column reasons to numeric empty-state', () => {
		const { container } = setupDom();
		mocks.renderBubbleChart.mockReturnValueOnce({ ok: false, reason: 'no-numeric' });
		renderBubbleChartSection({ config: defaultConfig(), rows: [], filterCallbacks });
		expect(container.querySelector('.chart-empty').textContent).toBe('chive-chart-empty-bubble-numeric');

		container.replaceChildren();
		mocks.renderBubbleChart.mockReturnValueOnce({ ok: false, reason: 'no-value-column' });
		renderBubbleChartSection({ config: defaultConfig(), rows: [], filterCallbacks });
		expect(container.querySelector('.chart-empty').textContent).toBe('chive-chart-empty-bubble-numeric');
	});

	it('maps no-nesting-columns and no-group-column reasons to nesting-required empty-state', () => {
		const { container } = setupDom();
		mocks.renderBubbleChart.mockReturnValueOnce({ ok: false, reason: 'no-nesting-columns' });
		renderBubbleChartSection({ config: defaultConfig(), rows: [], filterCallbacks });
		expect(container.querySelector('.chart-empty').textContent).toBe('chive-chart-empty-bubble-nesting-required');

		container.replaceChildren();
		mocks.renderBubbleChart.mockReturnValueOnce({ ok: false, reason: 'no-group-column' });
		renderBubbleChartSection({ config: defaultConfig(), rows: [], filterCallbacks });
		expect(container.querySelector('.chart-empty').textContent).toBe('chive-chart-empty-bubble-nesting-required');
	});

	it('falls back to the generic empty-state for any other failure reason', () => {
		const { container } = setupDom();
		mocks.renderBubbleChart.mockReturnValueOnce({ ok: false, reason: 'mystery' });

		renderBubbleChartSection({ config: defaultConfig(), rows: [], filterCallbacks });

		expect(container.querySelector('.chart-empty').textContent).toBe('chive-chart-empty-bubble');
	});

	it('renders happy path with chartHeight applied', () => {
		const { block, container } = setupDom();
		renderBubbleChartSection({
			config: defaultConfig({ chartHeight: 800 }),
			rows: [{ x: 1 }],
			filterCallbacks,
		});
		expect(block.style.display).toBe('block');
		expect(container.style.minHeight).toBe('800px');
	});

	it('falls back to the default chart height', () => {
		const { container } = setupDom();
		renderBubbleChartSection({
			config: defaultConfig({ chartHeight: 0 }),
			rows: [],
			filterCallbacks,
		});

		expect(container.style.minHeight).toBe('700px');
		expect(mocks.renderBubbleChart.mock.calls[0][3].measureMode).toBe('count');
	});
});
