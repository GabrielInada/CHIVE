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

	it('returns failure for empty rows and for rows without usable X values', () => {
		const container = document.getElementById('line');

		expect(renderLineChart(container, [], 'x', 'y').ok).toBe(false);
		expect(renderLineChart(container, [{ x: '', y: 1 }, { x: null, y: 2 }], 'x', 'y', {
			axisTypes: { x: 'number' },
		})).toEqual({ ok: false, reason: 'no-x-values' });
		expect(renderLineChart(container, [{ d: 'not-a-date', y: 1 }], 'd', 'y', {
			axisTypes: { x: 'date' },
		})).toEqual({ ok: false, reason: 'no-x-values' });
	});

	it('renders categorical axes, skips null categories, preserves order when sortX is false, and hides labels', () => {
		const container = document.getElementById('line');
		const rows = [
			{ bucket: 'Very long category name that should truncate', y: 2 },
			{ bucket: null, y: 4 },
			{ bucket: 'Alpha', y: 1 },
			{ bucket: 'Beta', y: 3 },
		];

		const result = renderLineChart(container, rows, 'bucket', 'y', {
			sortX: false,
			showXAxisLabel: false,
			showYAxisLabel: false,
			missingMode: 'gap',
		});

		expect(result.ok).toBe(true);
		expect(container.querySelector('svg')).not.toBeNull();
		const textValues = Array.from(container.querySelectorAll('text')).map(node => node.textContent);
		expect(textValues).not.toContain('bucket');
		expect(textValues).not.toContain('y');
		expect(container.textContent).toContain('Very long categor');
	});

	it('preserves categorical tick rotation and y-axis gridline clones', () => {
		const container = document.getElementById('line');
		const rows = [
			{ bucket: 'Alpha category', y: 1 },
			{ bucket: 'Beta category', y: 3 },
			{ bucket: 'Gamma category', y: 2 },
		];

		const result = renderLineChart(container, rows, 'bucket', 'y', {
			sortX: false,
		});

		expect(result.ok).toBe(true);
		const rotatedTicks = Array.from(container.querySelectorAll('.tick text'))
			.filter(tick => tick.getAttribute('transform') === 'rotate(-28)');
		expect(rotatedTicks.length).toBeGreaterThan(0);
		for (const tick of rotatedTicks) {
			expect(tick.style.textAnchor).toBe('end');
			expect(tick.getAttribute('dx')).toBe('-0.55em');
			expect(tick.getAttribute('dy')).toBe('0.2em');
		}

		const gridlines = Array.from(container.querySelectorAll('.tick line'))
			.filter(line => line.getAttribute('stroke-opacity') === '0.1' && Number(line.getAttribute('x2')) > 0);
		expect(gridlines.length).toBeGreaterThan(0);
	});

	it('covers sum and count aggregation branches for repeated X values', () => {
		const container = document.getElementById('line');
		const rows = [
			{ x: 1, y: 10 },
			{ x: 1, y: 20 },
			{ x: 2, y: '' },
			{ x: 2, y: 30 },
		];

		const sum = renderLineChart(container, rows, 'x', 'y', {
			axisTypes: { x: 'numeric' },
			aggregateMode: 'sum',
			showPoints: true,
		});
		expect(sum.ok).toBe(true);
		expect(container.querySelectorAll('circle.line-point')).toHaveLength(2);

		container.innerHTML = '';
		const count = renderLineChart(container, rows, 'x', 'y', {
			axisTypes: { x: 'numeric' },
			aggregateMode: 'count',
			showPoints: true,
		});
		expect(count.ok).toBe(true);
		expect(container.querySelectorAll('circle.line-point')).toHaveLength(2);
	});

	it('uses renderer fallbacks for invalid options and constant domains', () => {
		const container = document.getElementById('line');
		const rows = [
			{ x: 5, y: 10 },
			{ x: 5, y: 10 },
		];

		const result = renderLineChart(container, rows, 'x', 'y', {
			axisTypes: { x: 'unknown' },
			aggregateMode: 'bad',
			curve: 'bad',
			missingMode: 'bad',
			strokeWidth: 'bad',
			color: 'bad',
			ghostStrokeColor: 'bad',
			chartHeight: 'bad',
			showPoints: true,
		});

		expect(result.ok).toBe(true);
		expect(container.querySelector('path.line-path-main').getAttribute('stroke')).toBe('#4e79a7');
		expect(container.querySelector('path.line-path-main').getAttribute('stroke-width')).toBe('1.5');
		expect(container.querySelectorAll('circle.line-point')).toHaveLength(2);
	});

	it('clamps numeric dimensions and shows point tooltips on mouse events', () => {
		const container = document.getElementById('line');
		const rows = [
			{ x: 1, y: 10 },
			{ x: 2, y: 20 },
		];

		const result = renderLineChart(container, rows, 'x', 'y', {
			axisTypes: { x: 'number' },
			strokeWidth: 99,
			chartHeight: 1000,
			color: '#123456',
			showPoints: true,
			axisLabels: { x: 'Day', y: 'Visits' },
			locale: 'en-US',
		});

		expect(result.ok).toBe(true);
		const svg = container.querySelector('svg');
		expect(svg.getAttribute('height')).toBe('720');
		const path = container.querySelector('path.line-path-main');
		expect(path.getAttribute('stroke-width')).toBe('8');
		expect(path.getAttribute('stroke')).toBe('#123456');

		const point = container.querySelector('circle.line-point');
		point.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, pageX: 20, pageY: 30 }));
		expect(document.querySelector('.chart-tooltip')?.textContent).toContain('Day');
		point.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, pageX: 40, pageY: 50 }));
		point.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
		expect(document.querySelector('.chart-tooltip')?.style.display).toBe('none');
	});

	it('formats numeric and date tooltip values through the point renderer', () => {
		const container = document.getElementById('line');
		renderLineChart(container, [
			{ d: '2024-01-01', y: 10 },
			{ d: '2024-02-01', y: 20 },
		], 'd', 'y', {
			axisTypes: { x: 'date' },
			showPoints: true,
			axisLabels: { x: 'When', y: 'Total' },
		});

		const point = container.querySelector('circle.line-point');
		point.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, pageX: 20, pageY: 30 }));
		expect(document.querySelector('.chart-tooltip')?.textContent).toContain('When');
		expect(document.querySelector('.chart-tooltip')?.textContent).toContain('Total');
	});
});
