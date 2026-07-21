// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
	getLocale: vi.fn(() => 'en'),
	renderBubbleChart: vi.fn(() => ({ ok: true })),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
	getLocale: mocks.getLocale,
}));

vi.mock('../../../src/charts/bubble/renderers/svg.js', () => ({
	renderBubbleChart: mocks.renderBubbleChart,
}));

import { renderBubblePanelChart } from '../../../src/charts/bubble/panelAdapter.js';

const rows = [{ species: 'setosa', region: 'north', value: 12 }];

function createSpec(configOverrides = {}) {
	return {
		type: 'bubble',
		dataSnapshot: rows,
		config: {
			category: 'species',
			measureMode: 'sum',
			valueColumn: 'value',
			nestingMode: 'grouped',
			nestingColumns: ['region'],
			groupColumn: 'region',
			topN: 10,
			padding: 4,
			labelMode: 'auto',
			colorScheme: 'Bold',
			customTitle: 'Snapshot',
			chartHeight: 720,
			...configOverrides,
		},
	};
}

describe('renderBubblePanelChart', () => {
	let container;

	beforeEach(() => {
		vi.clearAllMocks();
		container = document.createElement('div');
	});

	it('maps a captured snapshot onto the shared bubble renderer contract', () => {
		const result = renderBubblePanelChart(container, createSpec());

		expect(result).toEqual({ ok: true });
		expect(mocks.renderBubbleChart).toHaveBeenCalledWith(
			container,
			rows,
			'species',
			expect.objectContaining({
				measureMode: 'sum',
				valueColumn: 'value',
				nestingMode: 'grouped',
				nestingColumns: ['region'],
				topN: 10,
				customTitle: 'Snapshot',
				chartHeight: 720,
				locale: 'en',
				filterCallbacks: {},
			}),
		);
	});

	it('normalizes invalid measure mode and supplies localized labels without panel filters', () => {
		renderBubblePanelChart(container, createSpec({ measureMode: 'invalid' }));

		const options = mocks.renderBubbleChart.mock.calls[0][3];
		expect(options.measureMode).toBe('count');
		expect(options.labels).toEqual({
			category: 'chive-chart-control-bubble-category',
			count: 'chive-tooltip-count',
			sum: 'chive-tooltip-sum',
			mean: 'chive-tooltip-mean',
			group: 'chive-chart-control-bubble-group',
			children: 'chive-chart-control-bubble-node-children-count',
			level: 'chive-chart-control-bubble-node-depth',
		});
		expect(options.filterCallbacks).toEqual({});
	});

	it('tolerates a snapshot without a config object', () => {
		renderBubblePanelChart(container, { type: 'bubble', dataSnapshot: rows });

		expect(mocks.renderBubbleChart).toHaveBeenCalledWith(
			container,
			rows,
			undefined,
			expect.objectContaining({ measureMode: 'count', filterCallbacks: {} }),
		);
	});

	it('returns renderer failures unchanged', () => {
		mocks.renderBubbleChart.mockReturnValueOnce({ ok: false, reason: 'no-nesting-columns' });

		expect(renderBubblePanelChart(container, createSpec())).toEqual({
			ok: false,
			reason: 'no-nesting-columns',
		});
	});
});
