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
