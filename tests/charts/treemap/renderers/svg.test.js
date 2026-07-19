// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderTreemap } from '../../../../src/charts/treemap/renderers/svg.js';
import { hideChartTooltip } from '../../../../src/charts/shared/tooltip/tooltip.js';

const ROWS = [
	{ region: 'North', sales: 30 },
	{ region: 'North', sales: 10 },
	{ region: 'South', sales: 25 },
	{ region: 'East', sales: 5 },
];

function rects(container) {
	return Array.from(container.querySelectorAll('rect'));
}

function fills(container) {
	return rects(container).map(r => r.getAttribute('fill'));
}

function dispatchMouse(el, type) {
	el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: 10, clientY: 10 }));
}

describe('renderTreemap', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="treemap"></div>';
	});

	afterEach(() => {
		hideChartTooltip();
	});

	it('returns failure when container or category column is missing', () => {
		const container = document.getElementById('treemap');
		expect(renderTreemap(null, ROWS, 'region').ok).toBe(false);
		expect(renderTreemap(container, ROWS, null).ok).toBe(false);
	});

	it('returns no-value-column when sum mode has no value column', () => {
		const container = document.getElementById('treemap');
		const result = renderTreemap(container, ROWS, 'region', { measureMode: 'sum' });
		expect(result.ok).toBe(false);
		expect(result.reason).toBe('no-value-column');
	});

	it('returns failure when there are no rows to aggregate', () => {
		const container = document.getElementById('treemap');
		expect(renderTreemap(container, [], 'region').ok).toBe(false);
	});

	it('returns failure when no category has a positive sum', () => {
		const container = document.getElementById('treemap');
		const zeros = [{ region: 'North', sales: 0 }, { region: 'South', sales: 0 }];
		const result = renderTreemap(container, zeros, 'region', { measureMode: 'sum', valueColumn: 'sales' });
		expect(result.ok).toBe(false);
	});

	it('renders one rect per category in count mode', () => {
		const container = document.getElementById('treemap');
		const result = renderTreemap(container, ROWS, 'region');
		expect(result.ok).toBe(true);
		// North, South, East -> 3 distinct categories.
		expect(rects(container).length).toBe(3);
		for (const rect of rects(container)) {
			expect(Number(rect.getAttribute('width'))).toBeGreaterThan(0);
			expect(Number(rect.getAttribute('height'))).toBeGreaterThan(0);
		}
	});

	it('slices to the topN largest categories', () => {
		const container = document.getElementById('treemap');
		const result = renderTreemap(container, ROWS, 'region', { topN: 2 });
		expect(result.ok).toBe(true);
		expect(rects(container).length).toBe(2);
	});

	it('aggregates numeric values and skips non-finite ones in sum mode', () => {
		const container = document.getElementById('treemap');
		const rows = [
			{ region: 'North', sales: 10 },
			{ region: 'North', sales: NaN },
			{ region: 'South', sales: 5 },
			{ region: 'East', sales: 'oops' },
		];
		const result = renderTreemap(container, rows, 'region', { measureMode: 'sum', valueColumn: 'sales' });
		expect(result.ok).toBe(true);
		// East only has a non-numeric value, so it never enters the treemap.
		expect(rects(container).length).toBe(2);
	});

	it('buckets nullish or empty categories as N/A', () => {
		const container = document.getElementById('treemap');
		const rows = [{ region: 'North' }, { region: null }, { region: '' }];
		const result = renderTreemap(container, rows, 'region');
		expect(result.ok).toBe(true);
		// North + a single N/A bucket = 2 cells.
		expect(rects(container).length).toBe(2);
		const texts = Array.from(container.querySelectorAll('text')).map(t => t.textContent);
		expect(texts.some(t => t.includes('N/A'))).toBe(true);
	});

	it('omits all text when labels and values are both hidden', () => {
		const container = document.getElementById('treemap');
		const result = renderTreemap(container, ROWS, 'region', { showLabels: false, showValues: false });
		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('text').length).toBe(0);
	});

	it('renders category labels when showLabels is on', () => {
		const container = document.getElementById('treemap');
		renderTreemap(container, ROWS, 'region', { showLabels: true, showValues: false });
		const texts = Array.from(container.querySelectorAll('text')).map(t => t.textContent);
		expect(texts.some(t => t.includes('North'))).toBe(true);
	});

	it('paints every rect with the uniform color in uniform mode', () => {
		const container = document.getElementById('treemap');
		renderTreemap(container, ROWS, 'region', { colorMode: 'uniform', color: '#123456' });
		expect(new Set(fills(container))).toEqual(new Set(['#123456']));
	});

	it('cycles palette colors in scheme mode', () => {
		const container = document.getElementById('treemap');
		renderTreemap(container, ROWS, 'region', { colorMode: 'scheme', colorScheme: 'Bold' });
		// Three categories pull three distinct palette entries.
		expect(new Set(fills(container)).size).toBe(3);
	});

	it('renders a custom title', () => {
		const container = document.getElementById('treemap');
		renderTreemap(container, ROWS, 'region', { customTitle: 'Revenue by region' });
		const texts = Array.from(container.querySelectorAll('text')).map(t => t.textContent);
		expect(texts).toContain('Revenue by region');
	});

	it('shows a hover tooltip with category and percentage', () => {
		const container = document.getElementById('treemap');
		renderTreemap(container, ROWS, 'region');
		dispatchMouse(rects(container)[0], 'mouseenter');
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip).not.toBeNull();
		expect(tooltip.style.display).toBe('block');
		expect(tooltip.textContent).toContain('%');
	});

	it('pins a tooltip with filter actions on click', () => {
		const container = document.getElementById('treemap');
		const onAdd = vi.fn();
		const onFocus = vi.fn();
		renderTreemap(container, ROWS, 'region', {
			filterCallbacks: {
				onAddToGlobalFilter: onAdd,
				onFocusGlobalFilter: onFocus,
				filterActionLabels: { focus: 'Focus', add: 'Add' },
			},
		});
		dispatchMouse(rects(container)[0], 'click');

		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip.classList.contains('chart-tooltip--fixado')).toBe(true);
		const actions = tooltip.querySelectorAll('.chart-tooltip__action');
		expect(actions.length).toBeGreaterThan(0);

		const addBtn = Array.from(actions).find(b => b.textContent === 'Add');
		addBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(onAdd).toHaveBeenCalled();
	});

	it('unpins when the same tile is clicked twice', () => {
		const container = document.getElementById('treemap');
		renderTreemap(container, ROWS, 'region', { filterCallbacks: {} });
		const firstRect = rects(container)[0];
		dispatchMouse(firstRect, 'click');
		expect(document.querySelector('.chart-tooltip').style.display).toBe('block');
		dispatchMouse(firstRect, 'click');
		expect(document.querySelector('.chart-tooltip').style.display).toBe('none');
	});
});
