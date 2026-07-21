// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
	getLocale: vi.fn(() => 'en'),
	renderTreemap: vi.fn(() => ({ ok: true })),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
	getLocale: mocks.getLocale,
}));

vi.mock('../../../src/charts/treemap/renderers/svg.js', () => ({
	renderTreemap: mocks.renderTreemap,
}));

import { renderTreemapPanelChart } from '../../../src/charts/treemap/panelAdapter.js';

const rows = [{ region: 'North', sales: 12 }];

function createSpec(configOverrides = {}) {
	return {
		type: 'treemap',
		dataSnapshot: rows,
		config: {
			category: 'region',
			measureMode: 'sum',
			valueColumn: 'sales',
			topN: 10,
			padding: 4,
			showLabels: true,
			showValues: false,
			color: '#112233',
			colorMode: 'uniform',
			colorScheme: 'Bold',
			customTitle: 'Snapshot',
			chartHeight: 420,
			...configOverrides,
		},
	};
}

describe('renderTreemapPanelChart', () => {
	let container;

	beforeEach(() => {
		vi.clearAllMocks();
		container = document.createElement('div');
	});

	it('maps a captured snapshot onto the shared treemap renderer contract', () => {
		const result = renderTreemapPanelChart(container, createSpec());

		expect(result).toEqual({ ok: true });
		expect(mocks.renderTreemap).toHaveBeenCalledWith(
			container,
			rows,
			'region',
			expect.objectContaining({
				measureMode: 'sum',
				valueColumn: 'sales',
				topN: 10,
				padding: 4,
				colorMode: 'uniform',
				customTitle: 'Snapshot',
				chartHeight: 420,
				locale: 'en',
				filterCallbacks: {},
			}),
		);
	});

	it('supplies localized labels without enabling panel filters', () => {
		renderTreemapPanelChart(container, createSpec());

		const options = mocks.renderTreemap.mock.calls[0][3];
		expect(options.labels).toEqual({
			category: 'chive-chart-control-treemap-category',
			count: 'chive-tooltip-count',
			sum: 'chive-tooltip-sum',
			percentage: 'chive-tooltip-percentage',
			focusOnThis: 'chive-tooltip-show-only-this',
			addToFilter: 'chive-tooltip-add-to-filter',
		});
		expect(options.filterCallbacks).toEqual({});
	});

	it('tolerates a snapshot without a config object', () => {
		renderTreemapPanelChart(container, { type: 'treemap', dataSnapshot: rows });

		expect(mocks.renderTreemap).toHaveBeenCalledWith(
			container,
			rows,
			undefined,
			expect.objectContaining({ filterCallbacks: {} }),
		);
	});

	it('returns renderer failures unchanged', () => {
		mocks.renderTreemap.mockReturnValueOnce({ ok: false, reason: 'no-value-column' });

		expect(renderTreemapPanelChart(container, createSpec())).toEqual({
			ok: false,
			reason: 'no-value-column',
		});
	});
});
