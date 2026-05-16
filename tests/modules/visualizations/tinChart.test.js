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
});
