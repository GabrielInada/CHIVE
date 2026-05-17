// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderTinChart } from '../../../src/modules/visualizations/tinChart.js';
import { hideChartTooltip } from '../../../src/modules/visualizations/tooltip.js';

const VALID_ROWS = [
	{ x: 0, y: 0, z: 1 },
	{ x: 10, y: 0, z: 3 },
	{ x: 10, y: 10, z: 5 },
	{ x: 0, y: 10, z: 7 },
	{ x: 5, y: 5, z: 4 },
];

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

	it('renders polygon count == triangles * 4^depth at depth 0 and depth 2', () => {
		const container = document.getElementById('tin');
		const depth0 = renderTinChart(container, VALID_ROWS, 'x', 'y', 'z', { subdivisionDepth: 0 });
		expect(depth0.ok).toBe(true);
		const polygons0 = container.querySelectorAll('.tin-triangles polygon').length;
		expect(polygons0).toBe(depth0.triangles);

		document.body.innerHTML = '<div id="tin"></div>';
		const container2 = document.getElementById('tin');
		const depth2 = renderTinChart(container2, VALID_ROWS, 'x', 'y', 'z', { subdivisionDepth: 2 });
		expect(depth2.ok).toBe(true);
		const polygons2 = container2.querySelectorAll('.tin-triangles polygon').length;
		expect(polygons2).toBe(depth2.triangles * Math.pow(4, 2));
	});

	it('renders one polygon per triangle in flat fill mode regardless of subdivisionDepth', () => {
		const container = document.getElementById('tin');
		const result = renderTinChart(container, VALID_ROWS, 'x', 'y', 'z', {
			fillMode: 'flat',
			subdivisionDepth: 2,
		});
		expect(result.ok).toBe(true);
		const polygons = container.querySelectorAll('.tin-triangles polygon').length;
		expect(polygons).toBe(result.triangles);
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
		const lines = container.querySelectorAll('.tin-isolines line');
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
		const lines = container.querySelectorAll('.tin-isolines line');
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
		const lines = container.querySelectorAll('.tin-isolines line');
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
		const lines = container.querySelectorAll('.tin-isolines line');
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
		const lines = container.querySelectorAll('.tin-threshold-contour line');
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
});
