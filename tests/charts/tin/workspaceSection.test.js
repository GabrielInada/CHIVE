// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	renderTinChart: vi.fn(() => ({ ok: true })),
	t: vi.fn(key => key),
	getLocale: vi.fn(() => 'en'),
}));

vi.mock('../../../src/charts/tin/renderers/svg.js', () => ({
	renderTinChart: mocks.renderTinChart,
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
	getLocale: mocks.getLocale,
}));

import { renderTinChartSection } from '../../../src/charts/tin/workspaceSection.js';
import { CHART_BLOCKS, CHART_CONTAINERS } from '../../../src/charts/workspaceDomIds.js';

function setupDom({ withContainer = true, withBlock = true } = {}) {
	document.body.innerHTML = '';
	let block = null;
	let container = null;
	if (withBlock) {
		block = document.createElement('div');
		block.id = CHART_BLOCKS.tin;
		document.body.appendChild(block);
	}
	if (withContainer) {
		container = document.createElement('div');
		container.id = CHART_CONTAINERS.tin;
		document.body.appendChild(container);
	}
	return { block, container };
}

function defaultConfig(overrides = {}) {
	return {
		enabled: true,
		x: 'lon',
		y: 'lat',
		z: 'alt',
		fillMode: 'gradient',
		subdivisionDepth: 0,
		colorRamp: 'Viridis',
		gradientMinColor: '#000',
		gradientMaxColor: '#fff',
		gradientDistribution: 'linear',
		showEdges: true,
		edgeColor: '#888',
		showPoints: false,
		pointRadius: 2,
		showZLabels: false,
		showHull: false,
		hullColor: '#999',
		showIsolines: false,
		isolineMode: 'count',
		isolineCount: 5,
		isolineStep: 100,
		isolineColor: '#000',
		isolineWidth: 1,
		colorIsolinesByZ: false,
		isolineMinColor: '#000',
		isolineMaxColor: '#fff',
		showIsolineLabels: false,
		isolineLabelSize: 10,
		isolineLabelColor: '#000',
		showThreshold: false,
		thresholdValue: 0,
		thresholdColor: '#f00',
		thresholdWidth: 2,
		showXAxisLabel: true,
		showYAxisLabel: true,
		chartHeight: 460,
		customTitle: '',
		...overrides,
	};
}

describe('renderTinChartSection', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.renderTinChart.mockReturnValue({ ok: true });
	});

	it('hides block and skips renderer when config is disabled', () => {
		const { block, container } = setupDom();
		container.appendChild(document.createElement('span'));

		renderTinChartSection({
			config: defaultConfig({ enabled: false }),
			rows: [],
		});

		expect(block.style.display).toBe('none');
		expect(container.children.length).toBe(0);
		expect(mocks.renderTinChart).not.toHaveBeenCalled();
	});

	it('does not throw when config is undefined', () => {
		setupDom();
		expect(() => renderTinChartSection({ config: undefined, rows: [] })).not.toThrow();
		expect(mocks.renderTinChart).not.toHaveBeenCalled();
	});

	it('does not throw and does not call renderer when container is missing', () => {
		const { block } = setupDom({ withContainer: false });
		renderTinChartSection({ config: defaultConfig(), rows: [] });
		expect(block.style.display).toBe('block');
		expect(mocks.renderTinChart).not.toHaveBeenCalled();
	});

	it('renders with full options object including all 40+ keys', () => {
		const { block, container } = setupDom();
		const rows = [{ lon: 1, lat: 2, alt: 3 }];

		renderTinChartSection({ config: defaultConfig({ chartHeight: 500 }), rows });

		expect(block.style.display).toBe('block');
		expect(container.style.minHeight).toBe('500px');
		const [calledContainer, calledRows, x, y, z, opts] = mocks.renderTinChart.mock.calls[0];
		expect(calledContainer).toBe(container);
		expect(calledRows).toBe(rows);
		expect(x).toBe('lon');
		expect(y).toBe('lat');
		expect(z).toBe('alt');
		expect(opts.fillMode).toBe('gradient');
		expect(opts.colorRamp).toBe('Viridis');
		expect(opts.showThreshold).toBe(false);
		expect(opts.axisLabels).toEqual({ x: 'lon', y: 'lat', z: 'alt' });
		expect(opts.locale).toBe('en');
	});

	it('handles missing block and falls back to default height and axis labels', () => {
		let { container } = setupDom({ withBlock: false });
		renderTinChartSection({
			config: defaultConfig({ x: '', y: '', z: '', chartHeight: 0 }),
			rows: [],
		});

		const opts = mocks.renderTinChart.mock.calls[0][5];
		expect(container.style.minHeight).toBe('460px');
		expect(opts.axisLabels).toEqual({
			x: 'chive-chart-control-tin-x',
			y: 'chive-chart-control-tin-y',
			z: 'chive-chart-control-tin-z',
		});

		({ container } = setupDom({ withBlock: false }));
		container.appendChild(document.createElement('span'));
		renderTinChartSection({
			config: defaultConfig({ enabled: false }),
			rows: [],
		});
		expect(container.children.length).toBe(0);
	});

	it('maps insufficient-points reason to specific empty-state', () => {
		const { container } = setupDom();
		mocks.renderTinChart.mockReturnValueOnce({ ok: false, reason: 'insufficient-points' });

		renderTinChartSection({ config: defaultConfig(), rows: [] });

		expect(container.querySelector('.chart-empty').textContent).toBe('chive-chart-empty-tin-insufficient-points');
	});

	it('falls back to generic empty-state for any other failure', () => {
		const { container } = setupDom();
		mocks.renderTinChart.mockReturnValueOnce({ ok: false, reason: 'other' });

		renderTinChartSection({ config: defaultConfig(), rows: [] });

		expect(container.querySelector('.chart-empty').textContent).toBe('chive-chart-empty-tin');
	});
});
