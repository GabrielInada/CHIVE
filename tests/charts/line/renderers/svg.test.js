// @vitest-environment jsdom

import { renderContext } from '../../renderContext.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderLineChart } from '../../../../src/charts/line/renderers/svg.js';
import { hideChartTooltip } from '../../../../src/charts/shared/tooltip/tooltip.js';

// Explicit enum inputs preserve the renderer's historical output.
const BASE_OPTIONS = { curve: 'linear', missingMode: 'connect', aggregateMode: 'none' };

describe('renderLineChart', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="line"></div>';
	});

	afterEach(() => {
		hideChartTooltip();
	});

	it('pins a nearby value on tap even with point markers hidden', () => {
		const container = document.getElementById('line');
		renderLineChart(container, [{ x: 1, y: 10 }, { x: 2, y: 20 }], {
			...BASE_OPTIONS, x: 'x', y: 'y', showPoints: false,
		}, renderContext({ x: 'x', y: 'y' }, { axisTypes: { x: 'number', y: 'number' } }));
		const path = container.querySelector('.line-path-main');
		const [, x, y] = path.getAttribute('d').match(/^M([\d.-]+),([\d.-]+)/);
		path.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: Number(x), clientY: Number(y) }));
		const tooltip = document.querySelector('.chart-tooltip--fixado');
		expect(tooltip.hidden).toBe(false);
		expect(tooltip.textContent).toContain('10');
		expect(container.querySelectorAll('.line-point')).toHaveLength(0);
		document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
		expect(tooltip.hidden).toBe(true);
	});

	it('renders a single main line path for numeric X and Y', () => {
		const container = document.getElementById('line');
		const rows = [
			{ x: 1, y: 10 },
			{ x: 2, y: 20 },
			{ x: 3, y: 15 },
		];
		const result = renderLineChart(container, rows, {
			x: 'x',
			y: 'y',
			...BASE_OPTIONS,
			missingMode: 'connect',
		}, renderContext({ x: 'x', y: 'y' }, {
			...BASE_OPTIONS,
			axisTypes: { x: 'number', y: 'number' },
		}));
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
		const result = renderLineChart(container, rows, {
			x: 'd',
			y: 'y',
			...BASE_OPTIONS,
		}, renderContext({ x: 'd', y: 'y' }, {
			...BASE_OPTIONS,
			axisTypes: { x: 'date', y: 'number' },
		}));
		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('svg').length).toBe(1);
	});

	it('returns no-numeric when Y values are all non-finite', () => {
		const container = document.getElementById('line');
		const rows = [
			{ x: 1, y: null },
			{ x: 2, y: 'oops' },
		];
		const result = renderLineChart(container, rows, {
			x: 'x',
			y: 'y',
			...BASE_OPTIONS,
		}, renderContext({ x: 'x', y: 'y' }, {
			...BASE_OPTIONS,
			axisTypes: { x: 'number', y: 'number' },
		}));
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
		const result = renderLineChart(container, rows, {
			x: 'x',
			y: 'y',
			...BASE_OPTIONS,
			missingMode: 'interpolate',
		}, renderContext({ x: 'x', y: 'y' }, {
			...BASE_OPTIONS,
			axisTypes: { x: 'number', y: 'number' },
		}));
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
		const result = renderLineChart(container, rows, {
			x: 'x',
			y: 'y',
			...BASE_OPTIONS,
			showPoints: true,
		}, renderContext({ x: 'x', y: 'y' }, {
			...BASE_OPTIONS,
			axisTypes: { x: 'number', y: 'number' },
		}));
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
		const result = renderLineChart(container, rows, {
			x: 'x',
			y: 'y',
			...BASE_OPTIONS,
			aggregateMode: 'mean',
			showPoints: true,
		}, renderContext({ x: 'x', y: 'y' }, {
			...BASE_OPTIONS,
			axisTypes: { x: 'number', y: 'number' },
		}));
		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('circle.line-point').length).toBe(2);
	});

	it('returns invalid-args without container or column names', () => {
		const container = document.getElementById('line');
		expect(renderLineChart(null, [{ x: 1, y: 1 }], {
			x: 'x',
			y: 'y',
			...BASE_OPTIONS,
		}, renderContext({ x: 'x', y: 'y' }, {
			...BASE_OPTIONS,
		})).ok).toBe(false);
		expect(renderLineChart(container, [{ x: 1, y: 1 }], {
			x: null,
			y: 'y',
			...BASE_OPTIONS,
		}, renderContext({ x: null, y: 'y' }, {
			...BASE_OPTIONS,
		})).ok).toBe(false);
		expect(renderLineChart(container, [{ x: 1, y: 1 }], {
			x: 'x',
			y: null,
			...BASE_OPTIONS,
		}, renderContext({ x: 'x', y: null }, {
			...BASE_OPTIONS,
		})).ok).toBe(false);
	});

	it('honors custom title and axis labels', () => {
		const container = document.getElementById('line');
		const rows = [
			{ x: 1, y: 10 },
			{ x: 2, y: 20 },
		];
		renderLineChart(container, rows, {
			x: 'x',
			y: 'y',
			...BASE_OPTIONS,
			customTitle: 'Trend',
		}, renderContext({ x: 'x', y: 'y' }, {
			...BASE_OPTIONS,
			axisTypes: { x: 'number', y: 'number' },
			axisLabels: { x: 'Day', y: 'Visits' },
		}));
		expect(container.textContent).toContain('Trend');
		expect(container.textContent).toContain('Day');
		expect(container.textContent).toContain('Visits');
	});

	it('returns failure for empty rows and for rows without usable X values', () => {
		const container = document.getElementById('line');

		expect(renderLineChart(container, [], {
			x: 'x',
			y: 'y',
			...BASE_OPTIONS,
		}, renderContext({ x: 'x', y: 'y' }, {
			...BASE_OPTIONS,
		})).ok).toBe(false);
		expect(renderLineChart(container, [{ x: '', y: 1 }, { x: null, y: 2 }], {
			x: 'x',
			y: 'y',
			...BASE_OPTIONS,
		}, renderContext({ x: 'x', y: 'y' }, {
			...BASE_OPTIONS,
			axisTypes: { x: 'number' },
		}))).toEqual({ ok: false, reason: 'no-x-values' });
		expect(renderLineChart(container, [{ d: 'not-a-date', y: 1 }], {
			x: 'd',
			y: 'y',
			...BASE_OPTIONS,
		}, renderContext({ x: 'd', y: 'y' }, {
			...BASE_OPTIONS,
			axisTypes: { x: 'date' },
		}))).toEqual({ ok: false, reason: 'no-x-values' });
	});

	it('renders categorical axes, skips null categories, preserves order when sortX is false, and hides labels', () => {
		const container = document.getElementById('line');
		const rows = [
			{ bucket: 'Very long category name that should truncate', y: 2 },
			{ bucket: null, y: 4 },
			{ bucket: 'Alpha', y: 1 },
			{ bucket: 'Beta', y: 3 },
		];

		const result = renderLineChart(container, rows, {
			x: 'bucket',
			y: 'y',
			...BASE_OPTIONS,
			sortX: false,
			showXAxisLabel: false,
			showYAxisLabel: false,
			missingMode: 'gap',
		}, renderContext({ x: 'bucket', y: 'y' }, {
			...BASE_OPTIONS,
		}));

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

		const result = renderLineChart(container, rows, {
			x: 'bucket',
			y: 'y',
			...BASE_OPTIONS,
			sortX: false,
		}, renderContext({ x: 'bucket', y: 'y' }, {
			...BASE_OPTIONS,
		}));

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

		const sum = renderLineChart(container, rows, {
			x: 'x',
			y: 'y',
			...BASE_OPTIONS,
			aggregateMode: 'sum',
			showPoints: true,
		}, renderContext({ x: 'x', y: 'y' }, {
			...BASE_OPTIONS,
			axisTypes: { x: 'numeric' },
		}));
		expect(sum.ok).toBe(true);
		expect(container.querySelectorAll('circle.line-point')).toHaveLength(2);

		container.innerHTML = '';
		const count = renderLineChart(container, rows, {
			x: 'x',
			y: 'y',
			...BASE_OPTIONS,
			aggregateMode: 'count',
			showPoints: true,
		}, renderContext({ x: 'x', y: 'y' }, {
			...BASE_OPTIONS,
			axisTypes: { x: 'numeric' },
		}));
		expect(count.ok).toBe(true);
		expect(container.querySelectorAll('circle.line-point')).toHaveLength(2);
	});

	it('uses numeric and color fallbacks with constant domains', () => {
		const container = document.getElementById('line');
		const rows = [
			{ x: 5, y: 10 },
			{ x: 5, y: 10 },
		];

		const result = renderLineChart(container, rows, {
			x: 'x',
			y: 'y',
			...BASE_OPTIONS,
			strokeWidth: 'bad',
			color: 'bad',
			ghostStrokeColor: 'bad',
			chartHeight: 'bad',
			showPoints: true,
		}, renderContext({ x: 'x', y: 'y' }, {
			...BASE_OPTIONS,
			axisTypes: { x: 'unknown' },
		}));

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

		const result = renderLineChart(container, rows, {
			x: 'x',
			y: 'y',
			...BASE_OPTIONS,
			strokeWidth: 99,
			chartHeight: 1000,
			color: '#123456',
			showPoints: true,
		}, renderContext({ x: 'x', y: 'y' }, {
			...BASE_OPTIONS,
			axisTypes: { x: 'number' },
			axisLabels: { x: 'Day', y: 'Visits' },
			locale: 'en-US',
		}));

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
		expect(document.querySelector('.chart-tooltip')?.hidden).toBe(true);
	});

	it('formats numeric and date tooltip values through the point renderer', () => {
		const container = document.getElementById('line');
		renderLineChart(container, [
			{ d: '2024-01-01', y: 10 },
			{ d: '2024-02-01', y: 20 },
		], {
			x: 'd',
			y: 'y',
			...BASE_OPTIONS,
			showPoints: true,
		}, renderContext({ x: 'd', y: 'y' }, {
			...BASE_OPTIONS,
			axisTypes: { x: 'date' },
			axisLabels: { x: 'When', y: 'Total' },
		}));

		const point = container.querySelector('circle.line-point');
		point.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, pageX: 20, pageY: 30 }));
		expect(document.querySelector('.chart-tooltip')?.textContent).toContain('When');
		expect(document.querySelector('.chart-tooltip')?.textContent).toContain('Total');
	});
});
