// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
	getLocale: vi.fn(() => 'en'),
	renderTinChart: vi.fn(() => ({ ok: true })),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
	getLocale: mocks.getLocale,
}));

vi.mock('../../../src/charts/tin/renderers/svg.js', () => ({
	renderTinChart: mocks.renderTinChart,
}));

import { renderTinPanelChart } from '../../../src/charts/tin/panelAdapter.js';

const rows = [{ x: 0, y: 0, z: 1 }];

function createSpec(configOverrides = {}) {
	return {
		type: 'tin',
		dataSnapshot: rows,
		config: {
			x: 'x',
			y: 'y',
			z: 'z',
			fillMode: 'smooth',
			subdivisionDepth: 3,
			colorRamp: 'viridis',
			gradientMinColor: '#112233',
			gradientMaxColor: '#abcdef',
			showEdges: true,
			showPoints: false,
			showIsolines: true,
			showThreshold: true,
			customTitle: 'Snapshot',
			chartHeight: 520,
			...configOverrides,
		},
	};
}

describe('renderTinPanelChart', () => {
	let container;

	beforeEach(() => {
		vi.clearAllMocks();
		container = document.createElement('div');
	});

	it('maps a captured snapshot onto the shared TIN renderer contract', () => {
		const result = renderTinPanelChart(container, createSpec());

		expect(result).toEqual({ ok: true });
		expect(mocks.renderTinChart).toHaveBeenCalledWith(
			container,
			rows,
			'x',
			'y',
			'z',
			expect.objectContaining({
				fillMode: 'smooth',
				subdivisionDepth: 3,
				colorRamp: 'viridis',
				showIsolines: true,
				showThreshold: true,
				customTitle: 'Snapshot',
				chartHeight: 520,
				locale: 'en',
			}),
		);
	});

	it('supplies localized fallback axis labels', () => {
		renderTinPanelChart(container, createSpec({ x: '', y: '', z: '' }));

		expect(mocks.renderTinChart.mock.calls[0][5].axisLabels).toEqual({
			x: 'chive-chart-control-tin-x',
			y: 'chive-chart-control-tin-y',
			z: 'chive-chart-control-tin-z',
		});
	});

	it('tolerates a snapshot without a config object', () => {
		renderTinPanelChart(container, { type: 'tin', dataSnapshot: rows });

		expect(mocks.renderTinChart).toHaveBeenCalledWith(
			container,
			rows,
			undefined,
			undefined,
			undefined,
			expect.objectContaining({ locale: 'en' }),
		);
	});

	it('returns renderer failures unchanged', () => {
		mocks.renderTinChart.mockReturnValueOnce({ ok: false, reason: 'insufficient-points' });

		expect(renderTinPanelChart(container, createSpec())).toEqual({
			ok: false,
			reason: 'insufficient-points',
		});
	});
});
