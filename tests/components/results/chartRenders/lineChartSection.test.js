// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	renderLineChart: vi.fn(() => ({ ok: true })),
	t: vi.fn(key => key),
	getLocale: vi.fn(() => 'en'),
}));

vi.mock('../../../../src/modules/visualizations/index.js', () => ({
	renderLineChart: mocks.renderLineChart,
}));

vi.mock('../../../../src/services/i18nService.js', () => ({
	t: mocks.t,
	getLocale: mocks.getLocale,
}));

import { renderLineChartSection } from '../../../../src/components/results/chartRenders/lineChartSection.js';
import { CHART_BLOCKS, CHART_CONTAINERS } from '../../../../src/config/elementIds.js';

function setupDom() {
	document.body.innerHTML = '';
	const block = document.createElement('div');
	block.id = CHART_BLOCKS.line;
	const container = document.createElement('div');
	container.id = CHART_CONTAINERS.line;
	document.body.append(block, container);
	return { block, container };
}

function defaultConfig(overrides = {}) {
	return {
		enabled: true,
		x: 'month',
		y: 'visits',
		curve: 'linear',
		missingMode: 'connect',
		strokeWidth: 1.5,
		color: '#4e79a7',
		ghostStrokeColor: '#cccccc',
		showPoints: false,
		sortX: true,
		aggregateMode: 'none',
		showXAxisLabel: true,
		showYAxisLabel: true,
		chartHeight: 320,
		customTitle: '',
		...overrides,
	};
}

const filterCallbacks = { onAddToGlobalFilter: null };

describe('renderLineChartSection', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.renderLineChart.mockReturnValue({ ok: true });
	});

	it('hides block and skips renderer when disabled', () => {
		const { block, container } = setupDom();
		container.appendChild(document.createElement('span'));

		renderLineChartSection({
			config: defaultConfig({ enabled: false }),
			rows: [],
			columnTypeByName: {},
			filterCallbacks,
		});

		expect(block.style.display).toBe('none');
		expect(container.children.length).toBe(0);
		expect(mocks.renderLineChart).not.toHaveBeenCalled();
	});

	it('forwards columnTypeByName into axisTypes', () => {
		setupDom();
		renderLineChartSection({
			config: defaultConfig({ x: 'month', y: 'visits' }),
			rows: [],
			columnTypeByName: { month: 'data', visits: 'numerico' },
			filterCallbacks,
		});

		expect(mocks.renderLineChart.mock.calls[0][4].axisTypes).toEqual({
			x: 'data',
			y: 'numerico',
		});
	});

	it('passes undefined for missing columns in the type map', () => {
		setupDom();
		renderLineChartSection({
			config: defaultConfig({ x: 'gone' }),
			rows: [],
			columnTypeByName: { visits: 'numerico' },
			filterCallbacks,
		});

		expect(mocks.renderLineChart.mock.calls[0][4].axisTypes.x).toBeUndefined();
	});

	it('maps no-numeric reason to numeric empty-state', () => {
		const { container } = setupDom();
		mocks.renderLineChart.mockReturnValueOnce({ ok: false, reason: 'no-numeric' });

		renderLineChartSection({
			config: defaultConfig(),
			rows: [],
			columnTypeByName: {},
			filterCallbacks,
		});

		expect(container.querySelector('.chart-vazio').textContent).toBe('chive-chart-empty-line-numeric');
	});

	it('maps no-x-values reason to x-specific empty-state', () => {
		const { container } = setupDom();
		mocks.renderLineChart.mockReturnValueOnce({ ok: false, reason: 'no-x-values' });

		renderLineChartSection({
			config: defaultConfig(),
			rows: [],
			columnTypeByName: {},
			filterCallbacks,
		});

		expect(container.querySelector('.chart-vazio').textContent).toBe('chive-chart-empty-line-x');
	});

	it('falls back to generic empty-state for any other failure', () => {
		const { container } = setupDom();
		mocks.renderLineChart.mockReturnValueOnce({ ok: false, reason: 'other' });

		renderLineChartSection({
			config: defaultConfig(),
			rows: [],
			columnTypeByName: {},
			filterCallbacks,
		});

		expect(container.querySelector('.chart-vazio').textContent).toBe('chive-chart-empty-line');
	});
});
