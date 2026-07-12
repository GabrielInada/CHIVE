// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderTinChart } from '../../../../src/charts/tin/renderers/svg.js';
import { hideChartTooltip } from '../../../../src/charts/shared/tooltip/tooltip.js';
import { interpolateColor } from '../../../../src/utils/colorUtils.js';
import { TIN_CHART } from '../../../../src/config/charts.js';

const VALID_ROWS = [
	{ x: 0, y: 0, z: 1 },
	{ x: 10, y: 0, z: 3 },
	{ x: 10, y: 10, z: 5 },
	{ x: 0, y: 10, z: 7 },
	{ x: 5, y: 5, z: 4 },
];

const BW_RAMP = { colorRamp: 'custom', gradientMinColor: '#000000', gradientMaxColor: '#ffffff' };

// Each <path> in .tin-triangles holds one subpath (an `M...Z` block) per leaf
// triangle in its color bucket, so counting `M`s recovers the leaf total that
// the old per-polygon DOM exposed directly.
function countSubpaths(container) {
	let total = 0;
	for (const path of container.querySelectorAll('.tin-triangles path')) {
		total += (path.getAttribute('d').match(/M/g) || []).length;
	}
	return total;
}

function pathFills(container) {
	return Array.from(container.querySelectorAll('.tin-triangles path')).map(p => p.getAttribute('fill'));
}

function gridRows(n, zFn) {
	const rows = [];
	for (let i = 0; i < n; i++) {
		for (let j = 0; j < n; j++) {
			rows.push({ x: i, y: j, z: zFn(i, j) });
		}
	}
	return rows;
}

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

	it('does not render an isolines group when showIsolines is false', () => {
		const container = document.getElementById('tin');
		const result = renderTinChart(container, VALID_ROWS, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			showIsolines: false,
		});
		expect(result.ok).toBe(true);
		expect(container.querySelector('.tin-isolines')).toBeNull();
	});

	it('renders at least one isoline segment when enabled on varied Z data', () => {
		const container = document.getElementById('tin');
		const result = renderTinChart(container, VALID_ROWS, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			showIsolines: true,
			isolineCount: 5,
			showEdges: false,
			showPoints: false,
		});
		expect(result.ok).toBe(true);
		const lines = container.querySelectorAll('.tin-isolines line:not(.tin-isoline-hit)');
		expect(lines.length).toBeGreaterThan(0);
	});

	it('emits one isoline segment per cutting level for a single triangle', () => {
		const container = document.getElementById('tin');
		// 3 vertices form a single triangle. Z values: two at 0, one at 10.
		// d3 ticks([0,10], 3) -> [0, 5, 10]. At level 0 and 10 the crossings
		// collapse onto a vertex (degenerate, filtered). Only level 5 cuts.
		const rows = [
			{ x: 0, y: 0, z: 0 },
			{ x: 10, y: 0, z: 0 },
			{ x: 5, y: 10, z: 10 },
		];
		const result = renderTinChart(container, rows, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			showIsolines: true,
			isolineCount: 3,
			showEdges: false,
			showPoints: false,
		});
		expect(result.ok).toBe(true);
		const lines = container.querySelectorAll('.tin-isolines line:not(.tin-isoline-hit)');
		expect(lines.length).toBe(1);
		// The two data-Y crossings both lie at data-Y = 5 (the iso-level at z=5
		// cuts the two non-baseline edges at their midpoints), so the segment
		// is horizontal in screen space.
		const y1 = Number(lines[0].getAttribute('y1'));
		const y2 = Number(lines[0].getAttribute('y2'));
		expect(Math.abs(y1 - y2)).toBeLessThan(1e-6);
	});

	it('does not render an isoline-labels group when showIsolineLabels is false', () => {
		const container = document.getElementById('tin');
		const result = renderTinChart(container, VALID_ROWS, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			showIsolines: true,
			isolineCount: 5,
			showIsolineLabels: false,
			showEdges: false,
			showPoints: false,
		});
		expect(result.ok).toBe(true);
		expect(container.querySelector('.tin-isoline-labels')).toBeNull();
	});

	it('emits exactly one isoline label for a single triangle cut by one level', () => {
		const container = document.getElementById('tin');
		const rows = [
			{ x: 0, y: 0, z: 0 },
			{ x: 10, y: 0, z: 0 },
			{ x: 5, y: 10, z: 10 },
		];
		const result = renderTinChart(container, rows, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			showIsolines: true,
			isolineCount: 3,
			showIsolineLabels: true,
			showEdges: false,
			showPoints: false,
		});
		expect(result.ok).toBe(true);
		const labels = container.querySelectorAll('.tin-isoline-labels text');
		expect(labels.length).toBe(1);
		expect(labels[0].textContent).toBe('5');
	});

	it('emits between 1 and isolineCount labels for varied Z data', () => {
		const container = document.getElementById('tin');
		const result = renderTinChart(container, VALID_ROWS, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			showIsolines: true,
			isolineCount: 5,
			showIsolineLabels: true,
			showEdges: false,
			showPoints: false,
		});
		expect(result.ok).toBe(true);
		const labels = container.querySelectorAll('.tin-isoline-labels text');
		expect(labels.length).toBeGreaterThan(0);
		expect(labels.length).toBeLessThanOrEqual(5);
	});

	it('colors all isoline segments with isolineColor when colorIsolinesByZ is off', () => {
		const container = document.getElementById('tin');
		const result = renderTinChart(container, VALID_ROWS, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			showIsolines: true,
			isolineCount: 5,
			isolineColor: '#abcdef',
			colorIsolinesByZ: false,
			showEdges: false,
			showPoints: false,
		});
		expect(result.ok).toBe(true);
		const lines = container.querySelectorAll('.tin-isolines line:not(.tin-isoline-hit)');
		expect(lines.length).toBeGreaterThan(0);
		for (const line of lines) {
			expect(line.getAttribute('stroke')).toBe('#abcdef');
		}
	});

	it('emits multiple distinct stroke colors when colorIsolinesByZ is on', () => {
		const container = document.getElementById('tin');
		const result = renderTinChart(container, VALID_ROWS, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			showIsolines: true,
			isolineCount: 5,
			colorIsolinesByZ: true,
			isolineMinColor: '#0000ff',
			isolineMaxColor: '#ff0000',
			showEdges: false,
			showPoints: false,
		});
		expect(result.ok).toBe(true);
		const lines = container.querySelectorAll('.tin-isolines line:not(.tin-isoline-hit)');
		expect(lines.length).toBeGreaterThan(0);
		const uniqueStrokes = new Set(Array.from(lines).map(l => l.getAttribute('stroke')));
		expect(uniqueStrokes.size).toBeGreaterThan(1);
	});

	it('uses the gradient midpoint for a contour at the middle of the Z range', () => {
		const container = document.getElementById('tin');
		// z=[0,0,10] with step=5 gives a single non-degenerate contour at level 5,
		// which is exactly halfway between zMin=0 and zMax=10.
		const rows = [
			{ x: 0, y: 0, z: 0 },
			{ x: 10, y: 0, z: 0 },
			{ x: 5, y: 10, z: 10 },
		];
		renderTinChart(container, rows, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			showIsolines: true,
			isolineMode: 'step',
			isolineStep: 5,
			colorIsolinesByZ: true,
			isolineMinColor: '#0000ff',
			isolineMaxColor: '#ff0000',
			showEdges: false,
			showPoints: false,
		});
		const lines = container.querySelectorAll('.tin-isolines line:not(.tin-isoline-hit)');
		expect(lines.length).toBe(1);
		const expected = interpolateColor('#0000ff', '#ff0000', 0.5);
		expect(lines[0].getAttribute('stroke')).toBe(expected);
	});

	it('emits one segment per step-mode level that cuts the triangle (step=5 on z=[0,0,10])', () => {
		const container = document.getElementById('tin');
		const rows = [
			{ x: 0, y: 0, z: 0 },
			{ x: 10, y: 0, z: 0 },
			{ x: 5, y: 10, z: 10 },
		];
		// Levels with step=5 from zMin=0 to zMax=10: [0, 5, 10]. Only level 5 cuts;
		// levels 0 and 10 are degenerate (filtered).
		const result = renderTinChart(container, rows, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			showIsolines: true,
			isolineMode: 'step',
			isolineStep: 5,
			showEdges: false,
			showPoints: false,
		});
		expect(result.ok).toBe(true);
		const lines = container.querySelectorAll('.tin-isolines line:not(.tin-isoline-hit)');
		expect(lines.length).toBe(1);
	});

	it('caps step-mode at maxIsolineLevels when step is extremely small', () => {
		const container = document.getElementById('tin');
		// VALID_ROWS z range is 1..7; with step 0.001 uncapped levels would be ~6000.
		// The 200-level cap bounds total segments at 200 * triangle_count.
		const result = renderTinChart(container, VALID_ROWS, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			showIsolines: true,
			isolineMode: 'step',
			isolineStep: 0.001,
			showEdges: false,
			showPoints: false,
		});
		expect(result.ok).toBe(true);
		const lines = container.querySelectorAll('.tin-isolines line:not(.tin-isoline-hit)');
		expect(lines.length).toBeLessThanOrEqual(200 * result.triangles);
	});

	it('does not render a threshold contour when showThreshold is false', () => {
		const container = document.getElementById('tin');
		const result = renderTinChart(container, VALID_ROWS, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			showThreshold: false,
			thresholdValue: 4,
			showEdges: false,
			showPoints: false,
		});
		expect(result.ok).toBe(true);
		expect(container.querySelector('.tin-threshold-contour')).toBeNull();
	});

	it('renders exactly one threshold segment cutting a single triangle at thresholdValue=5', () => {
		const container = document.getElementById('tin');
		const rows = [
			{ x: 0, y: 0, z: 0 },
			{ x: 10, y: 0, z: 0 },
			{ x: 5, y: 10, z: 10 },
		];
		const result = renderTinChart(container, rows, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			showIsolines: false,
			showThreshold: true,
			thresholdValue: 5,
			showEdges: false,
			showPoints: false,
		});
		expect(result.ok).toBe(true);
		const lines = container.querySelectorAll('.tin-threshold-contour line:not(.tin-isoline-hit)');
		expect(lines.length).toBe(1);
		const y1 = Number(lines[0].getAttribute('y1'));
		const y2 = Number(lines[0].getAttribute('y2'));
		expect(Math.abs(y1 - y2)).toBeLessThan(1e-6);
	});

	it('does not render a threshold contour when thresholdValue is outside [zMin,zMax]', () => {
		const container = document.getElementById('tin');
		const result = renderTinChart(container, VALID_ROWS, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			showThreshold: true,
			thresholdValue: 999,
			showEdges: false,
			showPoints: false,
		});
		expect(result.ok).toBe(true);
		expect(container.querySelector('.tin-threshold-contour')).toBeNull();
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

	it('emits one hit line per visible isoline segment', () => {
		const container = document.getElementById('tin');
		const result = renderTinChart(container, VALID_ROWS, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			showIsolines: true,
			isolineCount: 5,
			showEdges: false,
			showPoints: false,
		});
		expect(result.ok).toBe(true);
		const visible = container.querySelectorAll('.tin-isolines line:not(.tin-isoline-hit)');
		const hits = container.querySelectorAll('.tin-isolines line.tin-isoline-hit');
		expect(visible.length).toBeGreaterThan(0);
		expect(hits.length).toBe(visible.length);
	});

	it('hit lines are transparent, fattened, and carry data-z for tooltip lookup', () => {
		const container = document.getElementById('tin');
		renderTinChart(container, VALID_ROWS, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			showIsolines: true,
			isolineCount: 5,
			isolineWidth: 0.8,
			showEdges: false,
			showPoints: false,
		});
		const hits = container.querySelectorAll('.tin-isolines line.tin-isoline-hit');
		expect(hits.length).toBeGreaterThan(0);
		for (const hit of hits) {
			expect(hit.getAttribute('stroke')).toBe('transparent');
			expect(Number(hit.getAttribute('stroke-width'))).toBeGreaterThanOrEqual(6);
			expect(hit.getAttribute('pointer-events')).toBe('stroke');
			expect(Number.isFinite(Number(hit.dataset.z))).toBe(true);
		}
	});

	it('threshold contour also gets a hit line with data-z = thresholdValue', () => {
		const container = document.getElementById('tin');
		const rows = [
			{ x: 0, y: 0, z: 0 },
			{ x: 10, y: 0, z: 0 },
			{ x: 5, y: 10, z: 10 },
		];
		renderTinChart(container, rows, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			showIsolines: false,
			showThreshold: true,
			thresholdValue: 5,
			showEdges: false,
			showPoints: false,
		});
		const hits = container.querySelectorAll('.tin-threshold-contour line.tin-isoline-hit');
		expect(hits.length).toBe(1);
		expect(hits[0].getAttribute('stroke')).toBe('transparent');
		expect(Number(hits[0].dataset.z)).toBe(5);
	});
});

describe('renderTinChart full-ramp color rendering mode', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="tin"></div>';
	});

	afterEach(() => {
		hideChartTooltip();
	});

	// Single triangle with meanZ at t = 0.4 of the Z range: the exact ramp
	// gray is 102 (#666666) while bucket 51's center rounds to 103 (#676767),
	// so the two modes provably disagree on this input.
	const SINGLE_TRI_T04 = [
		{ x: 0, y: 0, z: 0 },
		{ x: 10, y: 0, z: 0.5 },
		{ x: 5, y: 10, z: 2.5 },
	];

	it('uses colorAt(meanZ) exactly, not the bucket-center color', () => {
		const container = document.getElementById('tin');
		const result = renderTinChart(container, SINGLE_TRI_T04, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			colorRenderingMode: 'full-ramp',
			...BW_RAMP,
		});
		expect(result.ok).toBe(true);
		expect(pathFills(container)).toEqual(['#666666']);

		document.body.innerHTML = '<div id="tin"></div>';
		const container2 = document.getElementById('tin');
		renderTinChart(container2, SINGLE_TRI_T04, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			colorRenderingMode: 'optimized',
			...BW_RAMP,
		});
		expect(pathFills(container2)).toEqual(['#676767']);
	});

	it('groups leaves with equal final CSS colors into one compound path', () => {
		const container = document.getElementById('tin');
		const rows = gridRows(6, (i, j) => i * 6 + j);
		const result = renderTinChart(container, rows, 'x', 'y', 'z', {
			subdivisionDepth: 2,
			colorRenderingMode: 'full-ramp',
			...BW_RAMP,
		});
		expect(result.ok).toBe(true);
		const fills = pathFills(container);
		// One path per distinct color: no two paths share a fill.
		expect(new Set(fills).size).toBe(fills.length);
		// Grouping is real: far fewer paths than leaves.
		expect(fills.length).toBeLessThan(result.polygons);
		expect(countSubpaths(container)).toBe(result.polygons);
	});

	it('generates identical triangle and leaf counts to optimized at the same depth', () => {
		const rows = gridRows(6, (i, j) => Math.sin(i) * Math.cos(j) * 10);
		const container = document.getElementById('tin');
		const optimized = renderTinChart(container, rows, 'x', 'y', 'z', {
			subdivisionDepth: 2,
			colorRenderingMode: 'optimized',
			...BW_RAMP,
		});
		const optimizedSubpaths = countSubpaths(container);

		document.body.innerHTML = '<div id="tin"></div>';
		const container2 = document.getElementById('tin');
		const fullRamp = renderTinChart(container2, rows, 'x', 'y', 'z', {
			subdivisionDepth: 2,
			colorRenderingMode: 'full-ramp',
			...BW_RAMP,
		});

		expect(fullRamp.triangles).toBe(optimized.triangles);
		expect(fullRamp.polygons).toBe(optimized.polygons);
		expect(countSubpaths(container2)).toBe(optimizedSubpaths);
	});

	it('keeps adaptive depth reduction active in full-ramp mode', () => {
		const container = document.getElementById('tin');
		const rows = gridRows(26, (i, j) => Math.sin(i) + Math.cos(j));
		const result = renderTinChart(container, rows, 'x', 'y', 'z', {
			subdivisionDepth: 4,
			colorRenderingMode: 'full-ramp',
		});
		expect(result.ok).toBe(true);
		expect(result.polygons).toBeLessThanOrEqual(TIN_CHART.maxSurfaceLeaves);
		expect(result.polygons).toBeLessThan(result.triangles * Math.pow(4, 4));
		expect(countSubpaths(container)).toBe(result.polygons);
	});

	it('renders a single low-color path for constant Z', () => {
		const container = document.getElementById('tin');
		const rows = [
			{ x: 0, y: 0, z: 5 },
			{ x: 10, y: 0, z: 5 },
			{ x: 10, y: 10, z: 5 },
			{ x: 0, y: 10, z: 5 },
			{ x: 5, y: 5, z: 5 },
		];
		const result = renderTinChart(container, rows, 'x', 'y', 'z', {
			subdivisionDepth: 3,
			colorRenderingMode: 'full-ramp',
			...BW_RAMP,
		});
		expect(result.ok).toBe(true);
		expect(pathFills(container)).toEqual(['#000000']);
		expect(countSubpaths(container)).toBe(result.triangles);
	});

	it('leaves overlays, axes, legend, and result fields on the shared path', () => {
		const container = document.getElementById('tin');
		const result = renderTinChart(container, VALID_ROWS, 'x', 'y', 'z', {
			subdivisionDepth: 1,
			colorRenderingMode: 'full-ramp',
			showIsolines: true,
			isolineCount: 4,
			showEdges: true,
			showPoints: true,
			showHull: true,
		});
		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('.tin-isolines line:not(.tin-isoline-hit)').length).toBeGreaterThan(0);
		expect(container.querySelectorAll('.tin-edges line').length).toBeGreaterThan(0);
		expect(container.querySelectorAll('.tin-points circle').length).toBe(VALID_ROWS.length);
		expect(container.querySelectorAll('.tin-legend rect').length).toBe(12);
		expect(result.polygons).toBe(result.triangles * 4);
	});
});

describe('TIN renderer module boundary', () => {
	it('exports only the SVG renderer', async () => {
		const mod = await import('../../../../src/charts/tin/renderers/svg.js');
		expect(Object.keys(mod)).toEqual(['renderTinChart']);
	});
});

describe('tinChart isoline/threshold hover (integration)', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="tin"></div>';
	});

	afterEach(() => {
		hideChartTooltip();
	});

	it('shows, moves, and hides the Z tooltip over an isoline hit line', () => {
		const container = document.getElementById('tin');
		renderTinChart(container, VALID_ROWS, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			showIsolines: true,
			isolineCount: 5,
			showEdges: false,
			showPoints: false,
		});
		const hit = container.querySelector('.tin-isolines line.tin-isoline-hit');
		expect(hit).not.toBeNull();

		hit.dispatchEvent(new MouseEvent('pointerover', { bubbles: true, clientX: 10, clientY: 20 }));
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip).not.toBeNull();
		expect(tooltip.style.display).toBe('block');
		// Tooltip line is "z: <value>"; the data-z drives the value.
		expect(tooltip.textContent).toContain('z');
		const initialPosition = { left: tooltip.style.left, top: tooltip.style.top };

		hit.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 120, clientY: 140 }));
		const movedTooltip = document.querySelector('.chart-tooltip');
		expect(movedTooltip.style.display).toBe('block');
		expect({ left: movedTooltip.style.left, top: movedTooltip.style.top }).not.toEqual(initialPosition);

		hit.dispatchEvent(new MouseEvent('pointerout', { bubbles: true }));
		expect(document.querySelector('.chart-tooltip').style.display).toBe('none');
	});

	it('shows the Z tooltip over a threshold hit line', () => {
		const container = document.getElementById('tin');
		const rows = [
			{ x: 0, y: 0, z: 0 },
			{ x: 10, y: 0, z: 0 },
			{ x: 5, y: 10, z: 10 },
		];
		renderTinChart(container, rows, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			showIsolines: false,
			showThreshold: true,
			thresholdValue: 5,
			showEdges: false,
			showPoints: false,
		});
		const hit = container.querySelector('.tin-threshold-contour line.tin-isoline-hit');
		expect(hit).not.toBeNull();

		hit.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip).not.toBeNull();
		expect(tooltip.style.display).toBe('block');
		expect(tooltip.textContent).toContain('5');
	});

	it('ignores hover over a non-hit target', () => {
		const container = document.getElementById('tin');
		renderTinChart(container, VALID_ROWS, 'x', 'y', 'z', {
			subdivisionDepth: 0,
			showIsolines: true,
			isolineCount: 5,
			showEdges: false,
			showPoints: false,
		});
		// The visible (non-hit) isoline line carries no data-z and should not trigger a tooltip.
		const visible = container.querySelector('.tin-isolines line:not(.tin-isoline-hit)');
		visible.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip === null || tooltip.style.display === 'none').toBe(true);
	});
});
