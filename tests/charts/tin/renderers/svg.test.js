// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIN_CHART } from '../../../../src/config/charts/definitions/tin.js';
import { hideChartTooltip } from '../../../../src/charts/shared/tooltip/tooltip.js';
import { renderTinChart } from '../../../../src/charts/tin/renderers/svg.js';
import {
	BW_RAMP,
	countSubpaths,
	gridRows,
	pathFills,
	VALID_ROWS,
} from './svg.testSupport.js';

describe('renderTinChart', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="tin"></div>';
	});

	afterEach(() => {
		hideChartTooltip();
	});

	it('returns failure when container or any column arg is missing', () => {
		const container = document.getElementById('tin');
		expect(renderTinChart(null, VALID_ROWS, 'x', 'y', 'z').ok).toBe(false);
		expect(renderTinChart(container, VALID_ROWS, null, 'y', 'z').ok).toBe(false);
		expect(renderTinChart(container, VALID_ROWS, 'x', null, 'z').ok).toBe(false);
		expect(renderTinChart(container, VALID_ROWS, 'x', 'y', null).ok).toBe(false);
	});

	it('returns insufficient-points when fewer than 3 valid rows', () => {
		const container = document.getElementById('tin');
		const result = renderTinChart(container, [{ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }], 'x', 'y', 'z');
		expect(result.ok).toBe(false);
		expect(result.reason).toBe('insufficient-points');
	});

	it('renders subpath count == triangles * 4^depth at depth 0 and depth 2', () => {
		const container = document.getElementById('tin');
		const depth0 = renderTinChart(container, VALID_ROWS, 'x', 'y', 'z', { subdivisionDepth: 0 });
		expect(depth0.ok).toBe(true);
		expect(countSubpaths(container)).toBe(depth0.triangles);
		expect(depth0.polygons).toBe(depth0.triangles * Math.pow(4, 0));
		expect(container.querySelectorAll('.tin-triangles polygon').length).toBe(0);
		const paths0 = container.querySelectorAll('.tin-triangles path').length;
		expect(paths0).toBeGreaterThanOrEqual(1);
		expect(paths0).toBeLessThanOrEqual(TIN_CHART.rampBuckets);

		document.body.innerHTML = '<div id="tin"></div>';
		const container2 = document.getElementById('tin');
		const depth2 = renderTinChart(container2, VALID_ROWS, 'x', 'y', 'z', { subdivisionDepth: 2 });
		expect(depth2.ok).toBe(true);
		expect(countSubpaths(container2)).toBe(depth2.triangles * Math.pow(4, 2));
		expect(depth2.polygons).toBe(depth2.triangles * Math.pow(4, 2));
		expect(container2.querySelectorAll('.tin-triangles path').length).toBeLessThanOrEqual(TIN_CHART.rampBuckets);
		// Coordinates are formatted to 2dp, so no `d` attribute carries 3+ decimals.
		for (const path of container2.querySelectorAll('.tin-triangles path')) {
			expect(/\.\d{3,}/.test(path.getAttribute('d'))).toBe(false);
		}
	});

	it('renders one subpath per triangle in flat fill mode regardless of subdivisionDepth', () => {
		const container = document.getElementById('tin');
		const result = renderTinChart(container, VALID_ROWS, 'x', 'y', 'z', {
			fillMode: 'flat',
			subdivisionDepth: 2,
		});
		expect(result.ok).toBe(true);
		expect(countSubpaths(container)).toBe(result.triangles);
		expect(result.polygons).toBe(result.triangles);
	});

	it('merges leaves into at most one path per color bucket', () => {
		const container = document.getElementById('tin');
		const rows = gridRows(6, (i, j) => i * 6 + j);
		const result = renderTinChart(container, rows, 'x', 'y', 'z', { subdivisionDepth: 2, ...BW_RAMP });
		expect(result.ok).toBe(true);
		const fills = pathFills(container);
		// One path per bucket: distinct bucket-center grays => distinct fills.
		expect(new Set(fills).size).toBe(fills.length);
		expect(fills.length).toBeLessThanOrEqual(TIN_CHART.rampBuckets);
		// Real merging: far fewer paths than leaf triangles.
		expect(fills.length).toBeLessThan(result.polygons);
		expect(countSubpaths(container)).toBe(result.polygons);
	});

	it('produces different fills for rank vs value distribution on skewed Z', () => {
		const skewed = [
			{ x: 0, y: 0, z: 1 },
			{ x: 10, y: 0, z: 1 },
			{ x: 10, y: 10, z: 1 },
			{ x: 0, y: 10, z: 1 },
			{ x: 5, y: 5, z: 100 },
		];
		const opts = { subdivisionDepth: 2, ...BW_RAMP };

		const container = document.getElementById('tin');
		renderTinChart(container, skewed, 'x', 'y', 'z', { ...opts, gradientDistribution: 'value' });
		const valueFills = [...new Set(pathFills(container))].sort().join('|');

		document.body.innerHTML = '<div id="tin"></div>';
		const container2 = document.getElementById('tin');
		renderTinChart(container2, skewed, 'x', 'y', 'z', { ...opts, gradientDistribution: 'rank' });
		const rankFills = [...new Set(pathFills(container2))].sort().join('|');

		expect(rankFills).not.toBe(valueFills);
	});

	it('renders a single low-color path for constant Z (depth forced to 0)', () => {
		const container = document.getElementById('tin');
		const rows = [
			{ x: 0, y: 0, z: 5 },
			{ x: 10, y: 0, z: 5 },
			{ x: 10, y: 10, z: 5 },
			{ x: 0, y: 10, z: 5 },
			{ x: 5, y: 5, z: 5 },
		];
		const result = renderTinChart(container, rows, 'x', 'y', 'z', { subdivisionDepth: 3, ...BW_RAMP });
		expect(result.ok).toBe(true);
		const paths = container.querySelectorAll('.tin-triangles path');
		expect(paths.length).toBe(1);
		expect(countSubpaths(container)).toBe(result.triangles);
		expect(result.polygons).toBe(result.triangles);
		expect(paths[0].getAttribute('fill')).toBe('#000000');
	});

	it('clamps subdivision depth to keep leaf count under the surface budget', () => {
		const container = document.getElementById('tin');
		const rows = gridRows(26, (i, j) => Math.sin(i) + Math.cos(j));
		const result = renderTinChart(container, rows, 'x', 'y', 'z', { subdivisionDepth: 4 });
		expect(result.ok).toBe(true);
		expect(result.polygons).toBeLessThanOrEqual(TIN_CHART.maxSurfaceLeaves);
		// Budget actually bit: fewer leaves than an unclamped depth-4 render.
		expect(result.polygons).toBeLessThan(result.triangles * Math.pow(4, 4));
		expect(countSubpaths(container)).toBe(result.polygons);
	});

	it('respects overlay toggles', () => {
		const container = document.getElementById('tin');
		const result = renderTinChart(container, VALID_ROWS, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			showEdges: false,
			showPoints: false,
			showZLabels: false,
			showHull: false,
		});
		expect(result.ok).toBe(true);
		expect(container.querySelector('.tin-edges')).toBeNull();
		expect(container.querySelector('.tin-points')).toBeNull();
		expect(container.querySelector('.tin-z-labels')).toBeNull();

		document.body.innerHTML = '<div id="tin"></div>';
		const container2 = document.getElementById('tin');
		const result2 = renderTinChart(container2, VALID_ROWS, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			showEdges: true,
			showPoints: true,
			showZLabels: true,
			showHull: true,
		});
		expect(result2.ok).toBe(true);
		expect(container2.querySelectorAll('.tin-edges line').length).toBeGreaterThan(0);
		expect(container2.querySelectorAll('.tin-points circle').length).toBe(VALID_ROWS.length);
		expect(container2.querySelectorAll('.tin-z-labels text').length).toBe(VALID_ROWS.length);
	});

	it('filters out rows with non-finite values', () => {
		const container = document.getElementById('tin');
		const rows = [
			...VALID_ROWS,
			{ x: 'oops', y: 1, z: 1 },
			{ x: 1, y: null, z: 1 },
			{ x: 1, y: 1, z: undefined },
		];
		const result = renderTinChart(container, rows, 'x', 'y', 'z', { subdivisionDepth: 0, showPoints: true });
		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('.tin-points circle').length).toBe(VALID_ROWS.length);
	});

	it('shows tooltip with X/Y/Z values on point hover', () => {
		const container = document.getElementById('tin');
		renderTinChart(container, VALID_ROWS, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			showPoints: true,
		});
		const firstPoint = container.querySelector('.tin-points circle');
		firstPoint.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip).not.toBeNull();
		expect(tooltip.textContent).toContain('x');
		expect(tooltip.textContent).toContain('y');
		expect(tooltip.textContent).toContain('z');
	});

	it('legend gradient swaps when a named color ramp is selected', () => {
		const container = document.getElementById('tin');
		const customOpts = {
			subdivisionDepth: 0,
			colorRamp: 'custom',
			gradientMinColor: '#000000',
			gradientMaxColor: '#ffffff',
		};
		renderTinChart(container, VALID_ROWS, 'x', 'y', 'z', customOpts);
		const customStops = Array.from(container.querySelectorAll('.tin-legend rect'))
			.map(r => r.getAttribute('fill'));

		document.body.innerHTML = '<div id="tin"></div>';
		const container2 = document.getElementById('tin');
		renderTinChart(container2, VALID_ROWS, 'x', 'y', 'z', { ...customOpts, colorRamp: 'viridis' });
		const viridisStops = Array.from(container2.querySelectorAll('.tin-legend rect'))
			.map(r => r.getAttribute('fill'));

		expect(customStops.length).toBe(12);
		expect(viridisStops.length).toBe(12);
		expect(viridisStops.join('|')).not.toBe(customStops.join('|'));
	});

	it('keeps the legend below the reserved chart area', () => {
		const container = document.getElementById('tin');
		const result = renderTinChart(container, VALID_ROWS, 'x', 'y', 'z', { subdivisionDepth: 0 });

		expect(result.ok).toBe(true);
		expect(container.querySelector('.tin-legend').getAttribute('transform')).toBe('translate(56,402)');
	});

	it('preserves the custom two-color gradient when colorRamp is custom (regression guard)', () => {
		const container = document.getElementById('tin');
		renderTinChart(container, VALID_ROWS, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			colorRamp: 'custom',
			gradientMinColor: '#000000',
			gradientMaxColor: '#ffffff',
		});
		// In custom mode the first legend stop is exactly the min color and the
		// last stop interpolates close to (but not exactly) the max color (12 stops, t at 11/12).
		const stops = container.querySelectorAll('.tin-legend rect');
		expect(stops[0].getAttribute('fill')).toBe('#000000');
		// Middle stop t=6/12=0.5 → '#808080' (gray midpoint of black/white).
		expect(stops[6].getAttribute('fill')).toBe('#808080');
	});
});

describe('TIN renderer module boundary', () => {
	it('exports only the SVG renderer', async () => {
		const mod = await import('../../../../src/charts/tin/renderers/svg.js');
		expect(Object.keys(mod)).toEqual(['renderTinChart']);
	});
});
