// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderScatterPlot } from '../../../src/modules/visualizations/scatterPlot.js';
import { hideChartTooltip } from '../../../src/modules/visualizations/tooltip.js';

describe('scatterPlot mixed axis behavior', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="scatter"></div>';
	});

	afterEach(() => {
		hideChartTooltip();
	});

	it('renders with categorical X and numeric Y values', () => {
		const container = document.getElementById('scatter');
		const rows = [
			{ group: 'A', value: 10 },
			{ group: 'B', value: 20 },
			{ group: null, value: 30 },
		];

		const result = renderScatterPlot(container, rows, 'group', 'value', {
			axisTypes: { x: 'texto', y: 'numero' },
		});

		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('circle')).toHaveLength(3);
	});

	it('ignores log mode for categorical axes', () => {
		const container = document.getElementById('scatter');
		const rows = [
			{ group: 'A', value: -10 },
			{ group: 'A', value: 5 },
		];

		const result = renderScatterPlot(container, rows, 'group', 'value', {
			xScale: 'log',
			yScale: 'linear',
			axisTypes: { x: 'texto', y: 'numero' },
		});

		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('circle')).toHaveLength(2);
	});

	it('applies deterministic jitter on categorical axes to reduce overplotting', () => {
		const container = document.getElementById('scatter');
		const rows = [
			{ group: 'A', value: 10 },
			{ group: 'A', value: 10 },
			{ group: 'A', value: 10 },
		];

		const result = renderScatterPlot(container, rows, 'group', 'value', {
			axisTypes: { x: 'texto', y: 'numero' },
		});

		expect(result.ok).toBe(true);
		const xValues = Array.from(container.querySelectorAll('circle'))
			.map(circle => circle.getAttribute('cx'));
		expect(new Set(xValues).size).toBeGreaterThan(1);
	});

	it('aggregates duplicated categorical pairs into one point when aggregate mode is enabled', () => {
		const container = document.getElementById('scatter');
		const rows = [
			{ x: 'A', y: 'North' },
			{ x: 'A', y: 'North' },
			{ x: 'A', y: 'South' },
			{ x: 'A', y: 'South' },
			{ x: 'A', y: 'South' },
		];

		const result = renderScatterPlot(container, rows, 'x', 'y', {
			axisTypes: { x: 'texto', y: 'texto' },
			categoricalPairMode: 'aggregate',
		});

		expect(result.ok).toBe(true);
		const circles = Array.from(container.querySelectorAll('circle'));
		expect(circles).toHaveLength(2);

		const radii = circles.map(circle => Number(circle.getAttribute('r'))).sort((a, b) => a - b);
		expect(radii[1]).toBeGreaterThan(radii[0]);
	});

	it('renders full categorical Y labels so long values are visible', () => {
		const container = document.getElementById('scatter');
		const longYLabel = 'Extremely long categorical label for y-axis visibility check';
		const rows = [
			{ x: 'A', y: longYLabel },
			{ x: 'B', y: longYLabel },
		];

		const result = renderScatterPlot(container, rows, 'x', 'y', {
			axisTypes: { x: 'texto', y: 'texto' },
		});

		expect(result.ok).toBe(true);
		expect(container.textContent).toContain(longYLabel);
	});

	it('preserves log validation for numeric axes', () => {
		const container = document.getElementById('scatter');
		const rows = [
			{ x: 0, y: 1 },
			{ x: -2, y: 2 },
		];

		const result = renderScatterPlot(container, rows, 'x', 'y', {
			xScale: 'log',
			yScale: 'linear',
			axisTypes: { x: 'numero', y: 'numero' },
		});

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('log-no-positive');
	});

	it('tooltip uses axis field names instead of generic X/Y', () => {
		const container = document.getElementById('scatter');
		const rows = [{ height_cm: 170, weight_kg: 65 }];

		renderScatterPlot(container, rows, 'height_cm', 'weight_kg', {
			axisTypes: { x: 'numero', y: 'numero' },
			labels: { eixoX: 'X', eixoY: 'Y', indice: 'Row', count: 'Count' },
		});

		const circle = container.querySelector('circle');
		circle.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip).not.toBeNull();
		const tooltipText = tooltip.textContent;
		expect(tooltipText).toContain('height_cm');
		expect(tooltipText).toContain('weight_kg');
	});

	it('tooltip honors explicit axisLabels override', () => {
		const container = document.getElementById('scatter');
		const rows = [{ a: 1, b: 2 }];

		renderScatterPlot(container, rows, 'a', 'b', {
			axisTypes: { x: 'numero', y: 'numero' },
			axisLabels: { x: 'Altura', y: 'Peso' },
		});

		const circle = container.querySelector('circle');
		circle.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
		const tooltipText = document.querySelector('.chart-tooltip').textContent;
		expect(tooltipText).toContain('Altura');
		expect(tooltipText).toContain('Peso');
	});

	it('infers categorical axis when axis type metadata is unavailable', () => {
		const container = document.getElementById('scatter');
		const rows = [
			{ kind: 'setosa', score: 1 },
			{ kind: 'versicolor', score: 2 },
			{ kind: 'virginica', score: 3 },
		];

		const result = renderScatterPlot(container, rows, 'kind', 'score');

		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('circle')).toHaveLength(3);
	});
});
