// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
	getLocale: vi.fn(() => 'en'),
	renderScatterPlot: vi.fn(() => ({ ok: true })),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
	getLocale: mocks.getLocale,
}));

vi.mock('../../../src/charts/scatter/renderers/svg.js', () => ({
	renderScatterPlot: mocks.renderScatterPlot,
}));

import { renderScatterPanelChart } from '../../../src/charts/scatter/panelAdapter.js';

const rows = [{ age: 30, salary: 4200 }, { age: 41, salary: 5100 }];
const columns = [
	{ name: 'age', type: 'number' },
	{ name: 'salary', type: 'number' },
];

function createSpec(configOverrides = {}, specOverrides = {}) {
	return {
		type: 'scatter',
		dataSnapshot: rows,
		columnsSnapshot: columns,
		config: {
			x: 'age',
			y: 'salary',
			xScale: 'log',
			yScale: 'linear',
			radius: 4,
			opacity: 0.7,
			sizeMode: 'numeric',
			sizeField: 'salary',
			sizeMin: 2,
			sizeMax: 12,
			color: '#1a472a',
			colorMode: 'numeric',
			colorField: 'age',
			gradientMinColor: '#1a472a',
			gradientMaxColor: '#ffffff',
			gradientDistribution: 'rank',
			colorScheme: 'Bold',
			categoricalPairMode: 'aggregate',
			showXAxisLabel: true,
			showYAxisLabel: false,
			regression: { enabled: true, mode: 'overall' },
			customTitle: 'Snapshot',
			chartHeight: 480,
			...configOverrides,
		},
		...specOverrides,
	};
}

describe('renderScatterPanelChart', () => {
	let container;

	beforeEach(() => {
		vi.clearAllMocks();
		container = document.createElement('div');
	});

	it('maps a frozen snapshot onto the shared scatter renderer contract', () => {
		const result = renderScatterPanelChart(container, createSpec());

		expect(result).toEqual({ ok: true });
		expect(mocks.renderScatterPlot).toHaveBeenCalledWith(
			container,
			rows,
			'age',
			'salary',
			expect.objectContaining({
				xScale: 'log',
				yScale: 'linear',
				radius: 4,
				opacity: 0.7,
				sizeMode: 'numeric',
				sizeField: 'salary',
				colorMode: 'numeric',
				gradientDistribution: 'rank',
				categoricalPairMode: 'aggregate',
				showYAxisLabel: false,
				regression: { enabled: true, mode: 'overall' },
				customTitle: 'Snapshot',
				chartHeight: 480,
				locale: 'en',
				xColumn: 'age',
				yColumn: 'salary',
				filterCallbacks: {},
			}),
		);
	});

	it('forwards the localized tooltip and regression label bag', () => {
		renderScatterPanelChart(container, createSpec());

		expect(mocks.renderScatterPlot.mock.calls[0][4].labels).toEqual({
			xAxis: 'chive-chart-control-scatter-x',
			yAxis: 'chive-chart-control-scatter-y',
			index: 'chive-tooltip-row',
			count: 'chive-tooltip-count',
			regressionSlope: 'chive-chart-tooltip-regression-slope',
			regressionIntercept: 'chive-chart-tooltip-regression-intercept',
			regressionR2: 'chive-chart-tooltip-regression-r2',
			regressionN: 'chive-chart-tooltip-regression-n',
			regressionGroup: 'chive-chart-tooltip-regression-group',
		});
	});

	it('resolves axisTypes from valid snapshot columns only', () => {
		renderScatterPanelChart(container, createSpec({}, {
			columnsSnapshot: [null, { type: 'number' }, { name: 'age', type: 'number' }],
		}));

		expect(mocks.renderScatterPlot.mock.calls[0][4].axisTypes).toEqual({
			x: 'number',
			y: undefined,
		});
	});

	it('tolerates a missing columns snapshot', () => {
		renderScatterPanelChart(container, createSpec({}, { columnsSnapshot: null }));

		expect(mocks.renderScatterPlot.mock.calls[0][4].axisTypes).toEqual({
			x: undefined,
			y: undefined,
		});
	});

	it('falls back to localized axis labels when chart columns are missing', () => {
		renderScatterPanelChart(container, createSpec({ x: '', y: '' }));

		expect(mocks.renderScatterPlot.mock.calls[0][4].axisLabels).toEqual({
			x: 'chive-chart-control-scatter-x',
			y: 'chive-chart-control-scatter-y',
		});
	});

	it('tolerates a snapshot without a config object', () => {
		renderScatterPanelChart(container, { type: 'scatter', dataSnapshot: rows });

		expect(mocks.renderScatterPlot).toHaveBeenCalledWith(
			container,
			rows,
			undefined,
			undefined,
			expect.objectContaining({ filterCallbacks: {} }),
		);
	});

	it('returns renderer failures unchanged', () => {
		mocks.renderScatterPlot.mockReturnValueOnce({ ok: false, reason: 'log-no-positive' });

		expect(renderScatterPanelChart(container, createSpec())).toEqual({
			ok: false,
			reason: 'log-no-positive',
		});
	});
});
