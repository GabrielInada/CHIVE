// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
	getLocale: vi.fn(() => 'en'),
	renderPieChart: vi.fn(() => ({ ok: true })),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
	getLocale: mocks.getLocale,
}));

vi.mock('../../../src/charts/pie/renderers/svg.js', () => ({
	renderPieChart: mocks.renderPieChart,
}));

import { renderPiePanelChart } from '../../../src/charts/pie/panelAdapter.js';

const rows = [{ region: 'North', sales: 12 }];

function createSpec(configOverrides = {}) {
	return {
		type: 'pie',
		dataSnapshot: rows,
		config: {
			category: 'region',
			measureMode: 'sum',
			valueColumn: 'sales',
			innerRadius: 24,
			outerRadius: 100,
			padAngle: 2,
			zoomScale: 1.2,
			topN: 10,
			topNMode: 'other',
			color: '#112233',
			showCategoryLabel: true,
			showValueLabel: false,
			showLegend: true,
			labelPosition: 'outside',
			customSliceColors: { North: '#abcdef' },
			customTitle: 'Snapshot',
			chartHeight: 420,
			...configOverrides,
		},
	};
}

describe('renderPiePanelChart', () => {
	let container;

	beforeEach(() => {
		vi.clearAllMocks();
		container = document.createElement('div');
	});

	it('maps a captured snapshot onto the shared pie renderer contract', () => {
		const result = renderPiePanelChart(container, createSpec());

		expect(result).toEqual({ ok: true });
		expect(mocks.renderPieChart).toHaveBeenCalledWith(
			container,
			rows,
			'region',
			expect.objectContaining({
				measureMode: 'sum',
				valueColumn: 'sales',
				customSliceColors: { North: '#abcdef' },
				customTitle: 'Snapshot',
				chartHeight: 420,
				locale: 'en',
				filterCallbacks: {},
			}),
		);
	});

	it('supplies the localized label contract without enabling panel filters', () => {
		renderPiePanelChart(container, createSpec());

		const options = mocks.renderPieChart.mock.calls[0][3];
		expect(options.labels).toEqual({
			category: 'chive-chart-control-pie-category',
			count: 'chive-tooltip-count',
			percentage: 'chive-tooltip-percentage',
			other: 'chive-chart-pie-other',
			focusOnThis: 'chive-tooltip-show-only-this',
			addToFilter: 'chive-tooltip-add-to-filter',
		});
		expect(options.filterCallbacks).toEqual({});
	});

	it('tolerates a snapshot without a config object', () => {
		renderPiePanelChart(container, { type: 'pie', dataSnapshot: rows });

		expect(mocks.renderPieChart).toHaveBeenCalledWith(
			container,
			rows,
			undefined,
			expect.objectContaining({ filterCallbacks: {} }),
		);
	});

	it('returns renderer failures unchanged', () => {
		mocks.renderPieChart.mockReturnValueOnce({ ok: false, reason: 'sum-no-numeric' });

		expect(renderPiePanelChart(container, createSpec())).toEqual({
			ok: false,
			reason: 'sum-no-numeric',
		});
	});
});
