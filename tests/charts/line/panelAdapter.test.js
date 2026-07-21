// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
	getLocale: vi.fn(() => 'en'),
	renderLineChart: vi.fn(() => ({ ok: true })),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
	getLocale: mocks.getLocale,
}));

vi.mock('../../../src/charts/line/renderers/svg.js', () => ({
	renderLineChart: mocks.renderLineChart,
}));

import { renderLinePanelChart } from '../../../src/charts/line/panelAdapter.js';

const rows = [{ month: '2024-01-01', visits: 12 }, { month: '2024-02-01', visits: 8 }];
const columns = [
	{ name: 'month', type: 'date' },
	{ name: 'visits', type: 'number' },
];

function createSpec(configOverrides = {}, specOverrides = {}) {
	return {
		type: 'line',
		dataSnapshot: rows,
		columnsSnapshot: columns,
		config: {
			x: 'month',
			y: 'visits',
			curve: 'monotone',
			missingMode: 'connect',
			strokeWidth: 2,
			color: '#4e79a7',
			ghostStrokeColor: '#cccccc',
			showPoints: true,
			sortX: true,
			aggregateMode: 'mean',
			showXAxisLabel: true,
			showYAxisLabel: false,
			customTitle: 'Snapshot',
			chartHeight: 480,
			...configOverrides,
		},
		...specOverrides,
	};
}

describe('renderLinePanelChart', () => {
	let container;

	beforeEach(() => {
		vi.clearAllMocks();
		container = document.createElement('div');
	});

	it('maps a captured snapshot onto the shared line renderer contract', () => {
		const result = renderLinePanelChart(container, createSpec());

		expect(result).toEqual({ ok: true });
		expect(mocks.renderLineChart).toHaveBeenCalledWith(
			container,
			rows,
			'month',
			'visits',
			expect.objectContaining({
				curve: 'monotone',
				missingMode: 'connect',
				strokeWidth: 2,
				showPoints: true,
				aggregateMode: 'mean',
				showYAxisLabel: false,
				customTitle: 'Snapshot',
				chartHeight: 480,
				locale: 'en',
				filterCallbacks: {},
			}),
		);
	});

	it('resolves axisTypes from valid snapshot columns only', () => {
		renderLinePanelChart(container, createSpec({}, {
			columnsSnapshot: [null, { type: 'number' }, { name: 'month', type: 'date' }],
		}));

		expect(mocks.renderLineChart.mock.calls[0][4].axisTypes).toEqual({
			x: 'date',
			y: undefined,
		});
	});

	it('tolerates a missing columns snapshot', () => {
		renderLinePanelChart(container, createSpec({}, { columnsSnapshot: null }));

		expect(mocks.renderLineChart.mock.calls[0][4].axisTypes).toEqual({
			x: undefined,
			y: undefined,
		});
	});

	it('falls back to localized axis labels when chart columns are missing', () => {
		renderLinePanelChart(container, createSpec({ x: '', y: '' }));

		expect(mocks.renderLineChart.mock.calls[0][4].axisLabels).toEqual({
			x: 'chive-chart-control-line-x',
			y: 'chive-chart-control-line-y',
		});
	});

	it('tolerates a snapshot without a config object', () => {
		renderLinePanelChart(container, { type: 'line', dataSnapshot: rows });

		expect(mocks.renderLineChart).toHaveBeenCalledWith(
			container,
			rows,
			undefined,
			undefined,
			expect.objectContaining({ filterCallbacks: {} }),
		);
	});

	it('returns renderer failures unchanged', () => {
		mocks.renderLineChart.mockReturnValueOnce({ ok: false, reason: 'no-numeric' });

		expect(renderLinePanelChart(container, createSpec())).toEqual({
			ok: false,
			reason: 'no-numeric',
		});
	});
});
