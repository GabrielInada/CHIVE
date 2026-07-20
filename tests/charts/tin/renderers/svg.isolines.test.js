// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hideChartTooltip } from '../../../../src/charts/shared/tooltip/tooltip.js';
import { renderTinChart } from '../../../../src/charts/tin/renderers/svg.js';
import { interpolateColor } from '../../../../src/utils/colorUtils.js';
import { VALID_ROWS } from './svg.testSupport.js';

describe('renderTinChart', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="tin"></div>';
	});

	afterEach(() => {
		hideChartTooltip();
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

describe('tinChart isoline/threshold hover (integration)', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="tin"></div>';
	});

	afterEach(() => {
		hideChartTooltip();
	});

	it('shows, moves, and hides the Z tooltip over an isoline hit line', async () => {
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
		await new Promise(resolve => requestAnimationFrame(resolve));
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip).not.toBeNull();
		expect(tooltip.hidden).toBe(false);
		// Tooltip line is "z: <value>"; the data-z drives the value.
		expect(tooltip.textContent).toContain('z');
		const initialPosition = { left: tooltip.style.left, top: tooltip.style.top };

		hit.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 120, clientY: 140 }));
		await new Promise(resolve => requestAnimationFrame(resolve));
		const movedTooltip = document.querySelector('.chart-tooltip');
		expect(movedTooltip.hidden).toBe(false);
		expect({ left: movedTooltip.style.left, top: movedTooltip.style.top }).not.toEqual(initialPosition);

		hit.dispatchEvent(new MouseEvent('pointerout', { bubbles: true }));
		expect(document.querySelector('.chart-tooltip').hidden).toBe(true);
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
		expect(tooltip.hidden).toBe(false);
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
		expect(tooltip === null || tooltip.hidden).toBe(true);
	});
});
