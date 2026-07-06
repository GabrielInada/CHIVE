// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	renderTreeMap: vi.fn(() => ({ ok: true })),
	t: vi.fn(key => key),
	getLocale: vi.fn(() => 'en'),
}));

vi.mock('../../../../src/modules/visualizations/treemapChart.js', () => ({
	renderTreeMap: mocks.renderTreeMap,
}));

vi.mock('../../../../src/services/i18nService.js', () => ({
	t: mocks.t,
	getLocale: mocks.getLocale,
}));

import { renderTreemapChartSection } from '../../../../src/components/datasetWorkspace/chartRenders/treemapChartSection.js';
import { CHART_BLOCKS, CHART_CONTAINERS } from '../../../../src/config/elementIds.js';

function setupDom() {
	document.body.innerHTML = '';
	const block = document.createElement('div');
	block.id = CHART_BLOCKS.treemap;
	const container = document.createElement('div');
	container.id = CHART_CONTAINERS.treemap;
	document.body.append(block, container);
	return { block, container };
}

function defaultConfig(overrides = {}) {
	return {
		enabled: true,
		category: 'region',
		measureMode: 'count',
		valueColumn: null,
		topN: 0,
		padding: 2,
		showLabels: true,
		showValues: false,
		color: '#4e79a7',
		colorMode: 'scheme',
		colorScheme: 'Bold',
		chartHeight: 380,
		customTitle: '',
		...overrides,
	};
}

const filterCallbacks = { onAddToGlobalFilter: null };

describe('renderTreemapChartSection', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.renderTreeMap.mockReturnValue({ ok: true });
	});

	it('hides block and skips renderer when disabled', () => {
		const { block, container } = setupDom();
		container.appendChild(document.createElement('span'));

		renderTreemapChartSection({
			config: defaultConfig({ enabled: false }),
			rows: [],
			filterCallbacks,
		});

		expect(block.style.display).toBe('none');
		expect(container.children.length).toBe(0);
		expect(mocks.renderTreeMap).not.toHaveBeenCalled();
	});

	it('maps no-value-column reason to numeric empty-state', () => {
		const { container } = setupDom();
		mocks.renderTreeMap.mockReturnValueOnce({ ok: false, reason: 'no-value-column' });

		renderTreemapChartSection({ config: defaultConfig(), rows: [], filterCallbacks });

		expect(container.querySelector('.chart-empty').textContent).toBe('chive-chart-empty-treemap-numeric');
	});

	it('falls back to generic empty-state for any other failure', () => {
		const { container } = setupDom();
		mocks.renderTreeMap.mockReturnValueOnce({ ok: false, reason: 'other' });

		renderTreemapChartSection({ config: defaultConfig(), rows: [], filterCallbacks });

		expect(container.querySelector('.chart-empty').textContent).toBe('chive-chart-empty-treemap');
	});

	it('renders happy path with category arg and full options', () => {
		const { block, container } = setupDom();

		renderTreemapChartSection({
			config: defaultConfig({ chartHeight: 500, colorMode: 'uniform' }),
			rows: [{ region: 'A' }],
			filterCallbacks,
		});

		expect(block.style.display).toBe('block');
		expect(container.style.minHeight).toBe('500px');
		const [calledContainer, calledRows, category, opts] = mocks.renderTreeMap.mock.calls[0];
		expect(calledContainer).toBe(container);
		expect(calledRows[0]).toEqual({ region: 'A' });
		expect(category).toBe('region');
		expect(opts.colorMode).toBe('uniform');
		expect(opts.filterCallbacks).toBe(filterCallbacks);
	});

	it('falls back to the default chart height', () => {
		const { container } = setupDom();

		renderTreemapChartSection({
			config: defaultConfig({ chartHeight: 0 }),
			rows: [],
			filterCallbacks,
		});

		expect(container.style.minHeight).toBe('380px');
	});
});
