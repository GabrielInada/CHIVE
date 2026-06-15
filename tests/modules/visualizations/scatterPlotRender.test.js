// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderScatterPlot } from '../../../src/modules/visualizations/scatterPlot.js';
import { hideChartTooltip } from '../../../src/modules/visualizations/tooltip.js';

const NUMERIC_ROWS = [
	{ x: 1, y: 2 },
	{ x: 2, y: 4 },
	{ x: 3, y: 5 },
	{ x: 4, y: 8 },
	{ x: 5, y: 9 },
];

function circles(container) {
	return Array.from(container.querySelectorAll('circle'));
}

function fills(container) {
	return circles(container).map(c => c.getAttribute('fill'));
}

function radii(container) {
	return circles(container).map(c => Number(c.getAttribute('r')));
}

function texts(container) {
	return Array.from(container.querySelectorAll('text')).map(t => t.textContent);
}

function dispatchMouse(el, type) {
	el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: 5, clientY: 5 }));
}

describe('renderScatterPlot rendering', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="scatter"></div>';
	});

	afterEach(() => {
		hideChartTooltip();
	});

	it('fails when container or a column is missing', () => {
		const container = document.getElementById('scatter');
		expect(renderScatterPlot(null, NUMERIC_ROWS, 'x', 'y').ok).toBe(false);
		expect(renderScatterPlot(container, NUMERIC_ROWS, null, 'y').ok).toBe(false);
		expect(renderScatterPlot(container, NUMERIC_ROWS, 'x', null).ok).toBe(false);
	});

	it('renders one circle per finite row and filters non-finite values', () => {
		const container = document.getElementById('scatter');
		const rows = [...NUMERIC_ROWS, { x: 6, y: 'not-a-number' }];
		const result = renderScatterPlot(container, rows, 'x', 'y');
		expect(result.ok).toBe(true);
		expect(circles(container).length).toBe(NUMERIC_ROWS.length);
	});

	it('applies uniform radius and opacity', () => {
		const container = document.getElementById('scatter');
		renderScatterPlot(container, NUMERIC_ROWS, 'x', 'y', { radius: 7, opacity: 0.5 });
		expect(radii(container).every(r => r === 7)).toBe(true);
		expect(circles(container).every(c => c.getAttribute('opacity') === '0.5')).toBe(true);
	});

	it('scales radius by a numeric size field within [sizeMin, sizeMax]', () => {
		const container = document.getElementById('scatter');
		const rows = [
			{ x: 1, y: 1, sz: 1 },
			{ x: 2, y: 2, sz: 5 },
			{ x: 3, y: 3, sz: 10 },
		];
		renderScatterPlot(container, rows, 'x', 'y', {
			sizeMode: 'numeric', sizeField: 'sz', sizeMin: 2, sizeMax: 12,
		});
		const r = radii(container);
		expect(Math.min(...r)).toBeCloseTo(2);
		expect(Math.max(...r)).toBeCloseTo(12);
		expect(new Set(r).size).toBeGreaterThan(1);
	});

	it('paints all points with the uniform color by default', () => {
		const container = document.getElementById('scatter');
		renderScatterPlot(container, NUMERIC_ROWS, 'x', 'y', { color: '#abcdef' });
		expect(new Set(fills(container))).toEqual(new Set(['#abcdef']));
	});

	it('maps a numeric color field across the gradient endpoints', () => {
		const container = document.getElementById('scatter');
		const rows = NUMERIC_ROWS.map((row, i) => ({ ...row, val: i }));
		renderScatterPlot(container, rows, 'x', 'y', {
			colorMode: 'numeric',
			colorField: 'val',
			gradientMinColor: '#000000',
			gradientMaxColor: '#ffffff',
		});
		const unique = new Set(fills(container));
		expect(unique.size).toBeGreaterThan(1);
		// min value -> min color, max value -> max color (interpolateColor uppercases).
		expect(unique.has('#000000')).toBe(true);
		expect(unique.has('#FFFFFF')).toBe(true);
	});

	it('produces different colors for rank vs value gradient distribution', () => {
		const skewed = [
			{ x: 1, y: 1, val: 1 },
			{ x: 2, y: 2, val: 1 },
			{ x: 3, y: 3, val: 1 },
			{ x: 4, y: 4, val: 100 },
		];
		const opts = { colorMode: 'numeric', colorField: 'val', gradientMinColor: '#000000', gradientMaxColor: '#ffffff' };

		const c1 = document.getElementById('scatter');
		renderScatterPlot(c1, skewed, 'x', 'y', { ...opts, gradientDistribution: 'value' });
		const valueFills = fills(c1).join('|');

		document.body.innerHTML = '<div id="scatter"></div>';
		const c2 = document.getElementById('scatter');
		renderScatterPlot(c2, skewed, 'x', 'y', { ...opts, gradientDistribution: 'rank' });
		const rankFills = fills(c2).join('|');

		expect(rankFills).not.toBe(valueFills);
	});

	it('assigns palette colors per category in category color mode', () => {
		const container = document.getElementById('scatter');
		const rows = [
			{ x: 1, y: 1, grp: 'a' },
			{ x: 2, y: 2, grp: 'b' },
			{ x: 3, y: 3, grp: 'a' },
		];
		renderScatterPlot(container, rows, 'x', 'y', {
			colorMode: 'category', colorField: 'grp', colorScheme: 'Bold',
		});
		// Bold palette: a -> #FF6B6B, b -> #4ECDC4.
		expect(new Set(fills(container))).toEqual(new Set(['#FF6B6B', '#4ECDC4']));
	});

	it('renders a custom title', () => {
		const container = document.getElementById('scatter');
		renderScatterPlot(container, NUMERIC_ROWS, 'x', 'y', { customTitle: 'My scatter' });
		expect(texts(container)).toContain('My scatter');
	});

	it('renders axis labels only when enabled', () => {
		const container = document.getElementById('scatter');
		renderScatterPlot(container, NUMERIC_ROWS, 'x', 'y', { axisLabels: { x: 'XLAB', y: 'YLAB' } });
		expect(texts(container)).toEqual(expect.arrayContaining(['XLAB', 'YLAB']));

		document.body.innerHTML = '<div id="scatter"></div>';
		const c2 = document.getElementById('scatter');
		renderScatterPlot(c2, NUMERIC_ROWS, 'x', 'y', {
			axisLabels: { x: 'XLAB', y: 'YLAB' }, showXAxisLabel: false, showYAxisLabel: false,
		});
		expect(texts(c2)).not.toContain('XLAB');
		expect(texts(c2)).not.toContain('YLAB');
	});
});

describe('renderScatterPlot interaction', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="scatter"></div>';
	});

	afterEach(() => {
		hideChartTooltip();
	});

	it('shows a hover tooltip with the point values', () => {
		const container = document.getElementById('scatter');
		renderScatterPlot(container, NUMERIC_ROWS, 'x', 'y');
		dispatchMouse(circles(container)[0], 'mouseenter');
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip).not.toBeNull();
		expect(tooltip.style.display).toBe('block');
		// First point is (1, 2).
		expect(tooltip.textContent).toContain('1');
		expect(tooltip.textContent).toContain('2');
	});

	it('repositions on mousemove without error', () => {
		const container = document.getElementById('scatter');
		renderScatterPlot(container, NUMERIC_ROWS, 'x', 'y');
		const circle = circles(container)[0];
		dispatchMouse(circle, 'mouseenter');
		expect(() => dispatchMouse(circle, 'mousemove')).not.toThrow();
		expect(document.querySelector('.chart-tooltip').style.display).toBe('block');
	});

	it('pins on click and unpins on a second click', () => {
		const container = document.getElementById('scatter');
		renderScatterPlot(container, NUMERIC_ROWS, 'x', 'y');
		const circle = circles(container)[0];
		dispatchMouse(circle, 'click');
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip.classList.contains('chart-tooltip--fixado')).toBe(true);
		dispatchMouse(circle, 'click');
		expect(tooltip.style.display).toBe('none');
	});

	it('clears a pinned tooltip on background click', () => {
		const container = document.getElementById('scatter');
		renderScatterPlot(container, NUMERIC_ROWS, 'x', 'y');
		dispatchMouse(circles(container)[0], 'click');
		expect(document.querySelector('.chart-tooltip').style.display).toBe('block');
		dispatchMouse(container.querySelector('svg'), 'click');
		expect(document.querySelector('.chart-tooltip').style.display).toBe('none');
	});
});

describe('renderScatterPlot regression overlay', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="scatter"></div>';
	});

	afterEach(() => {
		hideChartTooltip();
	});

	it('does not render regression nodes when disabled', () => {
		const container = document.getElementById('scatter');
		renderScatterPlot(container, NUMERIC_ROWS, 'x', 'y');
		expect(container.querySelector('.scatter-regression-line')).toBeNull();
		expect(container.querySelector('.scatter-regression-annotation')).toBeNull();
	});

	it('renders line, band, and annotation when enabled', () => {
		const container = document.getElementById('scatter');
		const result = renderScatterPlot(container, NUMERIC_ROWS, 'x', 'y', {
			regression: { enabled: true },
		});
		expect(result.ok).toBe(true);
		expect(container.querySelector('.scatter-regression-line')).not.toBeNull();
		expect(container.querySelector('.scatter-regression-band')).not.toBeNull();
		expect(container.querySelector('.scatter-regression-annotation')).not.toBeNull();
	});

	it('omits the confidence band when showCI is false', () => {
		const container = document.getElementById('scatter');
		renderScatterPlot(container, NUMERIC_ROWS, 'x', 'y', {
			regression: { enabled: true, showCI: false },
		});
		expect(container.querySelector('.scatter-regression-line')).not.toBeNull();
		expect(container.querySelector('.scatter-regression-band')).toBeNull();
	});

	it('shows a tooltip with regression stats on line hover', () => {
		const container = document.getElementById('scatter');
		renderScatterPlot(container, NUMERIC_ROWS, 'x', 'y', { regression: { enabled: true } });
		dispatchMouse(container.querySelector('.scatter-regression-line'), 'mouseenter');
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip).not.toBeNull();
		expect(tooltip.textContent).toContain('Slope');
	});
});

describe('renderScatterPlot log scale', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="scatter"></div>';
	});

	afterEach(() => {
		hideChartTooltip();
	});

	it('drops non-positive points on a log axis', () => {
		const container = document.getElementById('scatter');
		const rows = [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 0 }, { x: 4, y: 4 }];
		const result = renderScatterPlot(container, rows, 'x', 'y', { yScale: 'log' });
		expect(result.ok).toBe(true);
		// The y=0 row is removed on a log y-axis.
		expect(circles(container).length).toBe(3);
	});

	it('fails with log-no-positive when no points survive the log filter', () => {
		const container = document.getElementById('scatter');
		const rows = [{ x: 1, y: 0 }, { x: 2, y: -1 }];
		const result = renderScatterPlot(container, rows, 'x', 'y', { yScale: 'log' });
		expect(result.ok).toBe(false);
		expect(result.reason).toBe('log-no-positive');
	});
});

describe('renderScatterPlot categorical aggregation', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="scatter"></div>';
	});

	afterEach(() => {
		hideChartTooltip();
	});

	it('collapses repeated category pairs into aggregated bubbles', () => {
		const container = document.getElementById('scatter');
		const rows = [
			{ cx: 'a', cy: 'p' },
			{ cx: 'a', cy: 'p' },
			{ cx: 'b', cy: 'q' },
		];
		const result = renderScatterPlot(container, rows, 'cx', 'cy', { categoricalPairMode: 'aggregate' });
		expect(result.ok).toBe(true);
		// Two distinct (x, y) category pairs -> two bubbles.
		expect(circles(container).length).toBe(2);
	});
});
