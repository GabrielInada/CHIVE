// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
	getLocale: vi.fn(() => 'en'),
	renderBarChart: vi.fn(() => ({ ok: true })),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
	getLocale: mocks.getLocale,
}));

vi.mock('../../../src/charts/bar/renderers/svg.js', () => ({
	renderBarChart: mocks.renderBarChart,
}));

import { renderBarPanelChart } from '../../../src/charts/bar/panelAdapter.js';

const rows = [{ region: 'North', sales: 12 }];

function createSpec(overrides = {}) {
	return {
		type: 'bar',
		dataSnapshot: rows,
		config: {
			category: 'region',
			measureMode: 'count',
			valueColumn: null,
			sort: 'count-desc',
			topN: 10,
			color: '#112233',
			colorMode: 'uniform',
			gradientMinColor: '#112233',
			gradientMaxColor: '#ffffff',
			gradientDistribution: 'value',
			manualThresholdPct: 50,
			showXAxisLabel: true,
			showYAxisLabel: true,
			customTitle: 'Snapshot',
			chartHeight: 420,
			...overrides,
		},
	};
}

describe('renderBarPanelChart', () => {
	let container;

	beforeEach(() => {
		vi.clearAllMocks();
		container = document.createElement('div');
	});

	it('maps a frozen snapshot onto the shared bar renderer contract', () => {
		const result = renderBarPanelChart(container, createSpec());

		expect(result).toEqual({ ok: true });
		expect(mocks.renderBarChart).toHaveBeenCalledWith(
			container,
			rows,
			'region',
			expect.objectContaining({
				measureMode: 'count',
				customTitle: 'Snapshot',
				chartHeight: 420,
				locale: 'en',
				axisLabels: {
					x: 'region',
					y: 'chive-tooltip-count',
				},
				filterCallbacks: {},
			}),
		);
	});

	it.each([
		['sum', 'chive-tooltip-sum'],
		['mean', 'chive-tooltip-mean'],
		['invalid', 'chive-tooltip-count'],
	])('normalizes %s and builds its localized y-axis label', (measureMode, expectedLabel) => {
		renderBarPanelChart(container, createSpec({ measureMode }));

		const options = mocks.renderBarChart.mock.calls[0][3];
		expect(options.measureMode).toBe(measureMode === 'invalid' ? 'count' : measureMode);
		expect(options.axisLabels.y).toBe(expectedLabel);
	});

	it('tolerates a snapshot without config or rows', () => {
		renderBarPanelChart(container, { type: 'bar' });

		expect(mocks.renderBarChart).toHaveBeenCalledWith(
			container,
			[],
			undefined,
			expect.objectContaining({ measureMode: 'count' }),
		);
	});

	it('returns renderer failures unchanged', () => {
		mocks.renderBarChart.mockReturnValueOnce({ ok: false, reason: 'no-numeric' });

		expect(renderBarPanelChart(container, createSpec({ measureMode: 'sum' }))).toEqual({
			ok: false,
			reason: 'no-numeric',
		});
	});
});
