// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderLineChart } from '../../../src/modules/visualizations/lineChart.js';
import { hideChartTooltip } from '../../../src/modules/visualizations/tooltip.js';

describe('renderLineChart', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="line"></div>';
	});

	afterEach(() => {
		hideChartTooltip();
	});

	it('renders a single main line path for numeric X and Y', () => {
		const container = document.getElementById('line');
		const rows = [
			{ x: 1, y: 10 },
			{ x: 2, y: 20 },
			{ x: 3, y: 15 },
		];
		const result = renderLineChart(container, rows, 'x', 'y', {
			axisTypes: { x: 'number', y: 'number' },
			missingMode: 'connect',
		});
		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('path.line-path-main').length).toBe(1);
		expect(container.querySelectorAll('path.line-path-ghost').length).toBe(0);
	});

	it('renders a UTC scale when X column type is date', () => {
		const container = document.getElementById('line');
		const rows = [
			{ d: new Date('2024-01-01'), y: 1 },
			{ d: new Date('2024-02-01'), y: 2 },
			{ d: new Date('2024-03-01'), y: 3 },
		];
		const result = renderLineChart(container, rows, 'd', 'y', {
			axisTypes: { x: 'date', y: 'number' },
		});
		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('svg').length).toBe(1);
	});

	it('returns no-numeric when Y values are all non-finite', () => {
		const container = document.getElementById('line');
		const rows = [
			{ x: 1, y: null },
			{ x: 2, y: 'oops' },
		];
		const result = renderLineChart(container, rows, 'x', 'y', {
			axisTypes: { x: 'number', y: 'number' },
		});
		expect(result.ok).toBe(false);
		expect(result.reason).toBe('no-numeric');
	});

	it('renders two line paths in interpolate mode (ghost + main)', () => {
		const container = document.getElementById('line');
		const rows = [
			{ x: 1, y: 10 },
			{ x: 2, y: NaN },
			{ x: 3, y: 30 },
		];
		const result = renderLineChart(container, rows, 'x', 'y', {
			axisTypes: { x: 'number', y: 'number' },
			missingMode: 'interpolate',
		});
		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('path.line-path-main').length).toBe(1);
		expect(container.querySelectorAll('path.line-path-ghost').length).toBe(1);
	});

	it('shows points when showPoints is true', () => {
		const container = document.getElementById('line');
		const rows = [
			{ x: 1, y: 10 },
			{ x: 2, y: 20 },
		];
		const result = renderLineChart(container, rows, 'x', 'y', {
			axisTypes: { x: 'number', y: 'number' },
			showPoints: true,
		});
		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('circle.line-point').length).toBe(2);
	});

	it('collapses duplicate X values when aggregateMode is mean', () => {
		const container = document.getElementById('line');
		const rows = [
			{ x: 1, y: 10 },
			{ x: 1, y: 20 },
			{ x: 2, y: 30 },
		];
		const result = renderLineChart(container, rows, 'x', 'y', {
			axisTypes: { x: 'number', y: 'number' },
			aggregateMode: 'mean',
			showPoints: true,
		});
		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('circle.line-point').length).toBe(2);
	});

	it('returns invalid-args without container or column names', () => {
		const container = document.getElementById('line');
		expect(renderLineChart(null, [{ x: 1, y: 1 }], 'x', 'y').ok).toBe(false);
		expect(renderLineChart(container, [{ x: 1, y: 1 }], null, 'y').ok).toBe(false);
		expect(renderLineChart(container, [{ x: 1, y: 1 }], 'x', null).ok).toBe(false);
	});

	it('honors custom title and axis labels', () => {
		const container = document.getElementById('line');
		const rows = [
			{ x: 1, y: 10 },
			{ x: 2, y: 20 },
		];
		renderLineChart(container, rows, 'x', 'y', {
			axisTypes: { x: 'number', y: 'number' },
			customTitle: 'Trend',
			axisLabels: { x: 'Day', y: 'Visits' },
		});
		expect(container.textContent).toContain('Trend');
		expect(container.textContent).toContain('Day');
		expect(container.textContent).toContain('Visits');
	});
});
