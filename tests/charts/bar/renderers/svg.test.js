// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderBarChart } from '../../../../src/charts/bar/renderers/svg.js';
import { hideChartTooltip } from '../../../../src/charts/shared/tooltip/tooltip.js';
import { CHART_COLORS } from '../../../../src/config/charts/definitions.js';

function textValues(container) {
	return Array.from(container.querySelectorAll('text')).map(node => node.textContent);
}

describe('renderBarChart scaffold', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="bar"></div>';
	});

	afterEach(() => {
		hideChartTooltip();
	});

	it('renders SVG dimensions, top-N bars, title, and axis labels', () => {
		const container = document.getElementById('bar');
		const rows = [
			{ category: 'A' },
			{ category: 'A' },
			{ category: 'A' },
			{ category: 'B' },
			{ category: 'B' },
			{ category: 'C' },
		];

		const result = renderBarChart(container, rows, 'category', {
			topN: 2,
			customTitle: 'Top categories',
			axisLabels: { x: 'Category label', y: 'Count label' },
			chartHeight: 260,
		});

		expect(result.ok).toBe(true);
		const svg = container.querySelector('svg');
		expect(svg.getAttribute('width')).toBe('700');
		expect(svg.getAttribute('height')).toBe('260');
		expect(container.querySelectorAll('rect')).toHaveLength(2);
		expect(textValues(container)).toEqual(expect.arrayContaining([
			'Top categories',
			'Category label',
			'Count label',
		]));
	});

	it('does not apply the title offset when no custom title is set', () => {
		const container = document.getElementById('bar');
		const result = renderBarChart(container, [{ category: 'A' }], 'category');

		expect(result.ok).toBe(true);
		expect(container.querySelector('svg > g').getAttribute('transform')).toBe('translate(52,12)');
	});
});

describe('renderBarChart behavior', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="bar"></div>';
	});

	afterEach(() => {
		hideChartTooltip();
	});

	it('applies a custom uniform color to rendered bars', () => {
		const container = document.getElementById('bar');
		const rows = [
			{ categoria: 'A' },
			{ categoria: 'B' },
			{ categoria: 'A' },
		];

		const result = renderBarChart(container, rows, 'categoria', {
			color: '#112233',
		});

		expect(result.ok).toBe(true);
		const rect = container.querySelector('rect');
		expect(rect).not.toBeNull();
		expect(rect.getAttribute('fill')).toBe('#112233');
	});

	it('falls back to the default bar color on an invalid color', () => {
		const container = document.getElementById('bar');
		const rows = [{ categoria: 'A' }];

		renderBarChart(container, rows, 'categoria', {
			color: 'invalid-color',
		});

		const rect = container.querySelector('rect');
		expect(rect.getAttribute('fill')).toBe(CHART_COLORS.bar);
	});

	it('supports bar chart sum and mean measure modes with numeric value column', () => {
		const container = document.getElementById('bar');
		const rows = [
			{ categoria: 'A', valor: 10 },
			{ categoria: 'A', valor: 20 },
			{ categoria: 'B', valor: 30 },
		];

		const sumResult = renderBarChart(container, rows, 'categoria', {
			measureMode: 'sum',
			valueColumn: 'valor',
		});
		expect(sumResult.ok).toBe(true);

		const meanResult = renderBarChart(container, rows, 'categoria', {
			measureMode: 'mean',
			valueColumn: 'valor',
		});
		expect(meanResult.ok).toBe(true);
	});

	it('renders pinned bar tooltip actions for focus and add-to-filter', () => {
		const container = document.getElementById('bar');
		const calls = { focus: [], add: [] };
		const rows = [
			{ categoria: 'A' },
			{ categoria: 'A' },
			{ categoria: 'B' },
		];

		const result = renderBarChart(container, rows, 'categoria', {
			filterCallbacks: {
				onFocusGlobalFilter: (column, token) => calls.focus.push([column, token]),
				onAddToGlobalFilter: (column, token) => calls.add.push([column, token]),
			},
		});

		expect(result.ok).toBe(true);

		const firstBar = container.querySelector('rect');
		firstBar.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

		const buttons = document.querySelectorAll('.chart-tooltip__action');
		expect(buttons).toHaveLength(2);
		expect(document.querySelector('.chart-tooltip__actions')).not.toBeNull();

		buttons[0].click();
		buttons[1].click();

		expect(calls.focus).toEqual([['categoria', 'v:A']]);
		expect(calls.add).toEqual([['categoria', 'v:A']]);
	});

	it('adds an exclude (danger) action and a state badge when wired with the full filter bundle', () => {
		const container = document.getElementById('bar');
		const calls = { focus: [], add: [], excl: [] };
		const rows = [
			{ categoria: 'A' },
			{ categoria: 'A' },
			{ categoria: 'B' },
		];

		const result = renderBarChart(container, rows, 'categoria', {
			filterCallbacks: {
				onFocusGlobalFilter: (column, token) => calls.focus.push([column, token]),
				onAddToGlobalFilter: (column, token) => calls.add.push([column, token]),
				onExcludeGlobalFilter: (column, token) => calls.excl.push([column, token]),
				getTokenFilterState: () => null,
				filterActionLabels: {
					focus: 'Show only',
					add: 'Add',
					exclude: 'Hide',
					stateIncluded: 'In filter',
					stateExcluded: 'Excluded',
					close: 'Close',
				},
			},
		});

		expect(result.ok).toBe(true);

		const firstBar = container.querySelector('rect');
		firstBar.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

		const buttons = document.querySelectorAll('.chart-tooltip__action');
		expect(buttons).toHaveLength(3);
		expect(buttons[0].className).toContain('chart-tooltip__action--primary');
		expect(buttons[2].className).toContain('chart-tooltip__action--danger');
		buttons[2].click();
		expect(calls.excl).toEqual([['categoria', 'v:A']]);
	});

	it('hides "Show only this" when isShowOnlyThisRedundant returns true', () => {
		const container = document.getElementById('bar');
		const calls = { focus: [], add: [] };
		const rows = [
			{ categoria: 'A' },
			{ categoria: 'B' },
		];

		const result = renderBarChart(container, rows, 'categoria', {
			filterCallbacks: {
				onFocusGlobalFilter: (column, token) => calls.focus.push([column, token]),
				onAddToGlobalFilter: (column, token) => calls.add.push([column, token]),
				onExcludeGlobalFilter: () => {},
				getTokenFilterState: () => null,
				isShowOnlyThisRedundant: () => true,
			},
		});

		expect(result.ok).toBe(true);

		const firstBar = container.querySelector('rect');
		firstBar.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

		const buttons = document.querySelectorAll('.chart-tooltip__action');
		// no "Show only this", only [Add, Hide]
		expect(buttons).toHaveLength(2);
		expect(buttons[0].className).not.toContain('chart-tooltip__action--primary');
	});

	it('shows an "in filter" state badge and Remove action when token is already included', () => {
		const container = document.getElementById('bar');
		const calls = { focus: [], remove: [] };
		const rows = [
			{ categoria: 'A' },
			{ categoria: 'B' },
		];

		const result = renderBarChart(container, rows, 'categoria', {
			filterCallbacks: {
				onFocusGlobalFilter: (column, token) => calls.focus.push([column, token]),
				onAddToGlobalFilter: () => {},
				onExcludeGlobalFilter: () => {},
				onRemoveFromGlobalFilter: (column, token) => calls.remove.push([column, token]),
				getTokenFilterState: () => 'included',
				filterActionLabels: {
					focus: 'Show only',
					add: 'Add',
					exclude: 'Hide',
					remove: 'Remove',
					bringBack: 'Bring back',
					stateIncluded: 'In filter',
					stateExcluded: 'Excluded',
					close: 'Close',
				},
			},
		});

		expect(result.ok).toBe(true);

		const firstBar = container.querySelector('rect');
		firstBar.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

		const badge = document.querySelector('.chart-tooltip__filter-state--included');
		expect(badge).not.toBeNull();
		expect(badge.textContent).toContain('In filter');
		const buttons = document.querySelectorAll('.chart-tooltip__action');
		expect(buttons).toHaveLength(2);
		expect(buttons[1].textContent).toBe('Remove');
		buttons[1].click();
		expect(calls.remove).toEqual([['categoria', 'v:A']]);
	});

	it('returns explicit failure reasons for bar sum/mean when value column is missing or non-numeric', () => {
		const container = document.getElementById('bar');
		const rows = [
			{ categoria: 'A', valor: 'x' },
			{ categoria: 'B', valor: 'y' },
		];

		const noColumnResult = renderBarChart(container, rows, 'categoria', {
			measureMode: 'sum',
			valueColumn: 'inexistente',
		});
		expect(noColumnResult.ok).toBe(false);
		expect(noColumnResult.reason).toBe('no-value-column');

		const noNumericResult = renderBarChart(container, rows, 'categoria', {
			measureMode: 'sum',
			valueColumn: 'valor',
		});
		expect(noNumericResult.ok).toBe(false);
		expect(noNumericResult.reason).toBe('no-numeric');
	});

	it('covers bar chart sorting, topN, color modes, title, and hidden axis labels', () => {
		const container = document.getElementById('bar');
		const rows = [
			{ categoria: 'B', valor: 10 },
			{ categoria: 'A', valor: 5 },
			{ categoria: 'C', valor: 20 },
			{ categoria: '', valor: 1 },
			{ categoria: null, valor: 2 },
		];

		let result = renderBarChart(container, rows, 'categoria', {
			sort: 'label-asc',
			topN: 3,
			colorMode: 'gradient',
			gradientDistribution: 'rank',
			gradientMinColor: '#000000',
			gradientMaxColor: '#ffffff',
			customTitle: 'Ranked Bars',
			showXAxisLabel: false,
			showYAxisLabel: false,
			chartHeight: 999,
		});
		expect(result.ok).toBe(true);
		expect(container.textContent).toContain('Ranked Bars');
		expect(container.querySelectorAll('rect').length).toBe(3);
		expect(container.textContent).not.toContain('categoria');

		result = renderBarChart(container, rows, 'categoria', {
			sort: 'label-desc',
			colorMode: 'gradient-manual',
			manualThresholdPct: -50,
			gradientMinColor: '#111111',
			gradientMaxColor: '#eeeeee',
		});
		expect(result.ok).toBe(true);
		expect(Array.from(container.querySelectorAll('rect')).some(rect => rect.getAttribute('fill') === '#111111')).toBe(true);

		result = renderBarChart(container, rows, 'categoria', {
			sort: 'count-asc',
			colorMode: 'gradient-manual',
			manualThresholdPct: 150,
			gradientMinColor: '#111111',
			gradientMaxColor: '#eeeeee',
		});
		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('rect').length).toBeGreaterThan(0);
	});

	it('covers bar chart invalid arguments, empty rows, invalid measure mode, and pinned toggle interactions', () => {
		const container = document.getElementById('bar');
		expect(renderBarChart(null, [], 'categoria').ok).toBe(false);
		expect(renderBarChart(container, [], '').ok).toBe(false);
		expect(renderBarChart(container, [], 'categoria').ok).toBe(false);

		const result = renderBarChart(container, [{ categoria: 'A' }], 'categoria', {
			measureMode: 'not-real',
			filterCallbacks: {
				getTokenFilterState: () => 'excluded',
				onBringBackGlobalFilter: () => {},
				filterActionLabels: {
					stateExcluded: 'Excluded',
					bringBack: 'Bring back',
				},
			},
		});
		expect(result.ok).toBe(true);
		const firstBar = container.querySelector('rect');
		firstBar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, pageX: 1, pageY: 1 }));
		firstBar.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, pageX: 2, pageY: 2 }));
		firstBar.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
		firstBar.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		expect(document.querySelector('.chart-tooltip__filter-state--excluded')).not.toBeNull();
		firstBar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, pageX: 3, pageY: 3 }));
		firstBar.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		expect(document.querySelector('.chart-tooltip').hidden).toBe(true);
		container.querySelector('svg').dispatchEvent(new MouseEvent('click', { bubbles: true }));
	});

	it('toggles axis labels independently', () => {
		const barContainer = document.getElementById('bar');
		const barData = [
			{ categoria: 'A' },
			{ categoria: 'A' },
			{ categoria: 'B' },
		];

		renderBarChart(barContainer, barData, 'categoria', {
			showXAxisLabel: true,
			showYAxisLabel: false,
			axisLabels: {
				x: 'Bar Axis X Custom',
				y: 'Bar Axis Y Custom',
			},
		});
		expect(barContainer.textContent).toContain('Bar Axis X Custom');
		expect(barContainer.textContent).not.toContain('Bar Axis Y Custom');
	});
});

describe('renderBarChart with totals at or below 0', () => {
	// The default 320px chart less its 12px top and 90px bottom margins.
	const PLOT_HEIGHT = 218;
	const MIXED_ROWS = [
		{ team: 'A', profit: 5 },
		{ team: 'B', profit: -3 },
		{ team: 'C', profit: 2 },
	];
	const NEGATIVE_ROWS = [
		{ team: 'A', profit: -5 },
		{ team: 'B', profit: -3 },
	];
	const SUM = { measureMode: 'sum', valueColumn: 'profit' };

	const bars = container => Array.from(container.querySelectorAll('rect')).map(rect => ({
		key: rect.__data__.key,
		y: Number(rect.getAttribute('y')),
		height: Number(rect.getAttribute('height')),
	}));
	const yTicks = container => Array.from(container.querySelectorAll('g[text-anchor="end"] > .tick > text'))
		.map(text => text.textContent);
	const tooltipText = rect => {
		rect.dispatchEvent(new MouseEvent('mouseenter'));
		return document.querySelector('.chart-tooltip').textContent;
	};

	beforeEach(() => {
		document.body.innerHTML = '<div id="bar"></div>';
	});

	afterEach(() => {
		hideChartTooltip();
	});

	it.each(['sum', 'mean'])('draws a total below 0 down from 0 and the others up from it in %s mode', measureMode => {
		const container = document.getElementById('bar');

		const result = renderBarChart(container, MIXED_ROWS, 'team', { measureMode, valueColumn: 'profit' });

		expect(result.ok).toBe(true);
		const [a, c, b] = bars(container);
		expect([a.key, c.key, b.key]).toEqual(['A', 'C', 'B']);
		const zero = a.y + a.height;
		expect(c.y + c.height).toBe(zero);
		expect(b.y).toBe(zero);
		expect(b.height).toBeCloseTo((a.height * 3) / 5);
		expect(b.y + b.height).toBeLessThanOrEqual(PLOT_HEIGHT);
	});

	it('hangs every bar from 0 at the top of the plot when every total is below 0', () => {
		const container = document.getElementById('bar');

		renderBarChart(container, NEGATIVE_ROWS, 'team', SUM);

		const [b, a] = bars(container);
		expect([b.key, a.key]).toEqual(['B', 'A']);
		expect([b.y, a.y]).toEqual([0, 0]);
		expect(a.height).toBe(PLOT_HEIGHT);
		expect(b.height).toBeCloseTo((PLOT_HEIGHT * 3) / 5);
	});

	it('hangs a total below 0 from the top of the plot when the largest total is 0', () => {
		const container = document.getElementById('bar');

		renderBarChart(container, [{ team: 'A', profit: 0 }, { team: 'B', profit: -3 }], 'team', SUM);

		expect(bars(container)).toEqual([
			{ key: 'A', y: 0, height: 0 },
			{ key: 'B', y: 0, height: PLOT_HEIGHT },
		]);
	});

	it('keeps a readable axis and draws every bar at 0 when every total is 0', () => {
		const container = document.getElementById('bar');

		renderBarChart(container, [{ team: 'A', profit: 0 }, { team: 'B', profit: 0 }], 'team', SUM);

		expect(bars(container)).toEqual([
			{ key: 'A', y: PLOT_HEIGHT, height: 0 },
			{ key: 'B', y: PLOT_HEIGHT, height: 0 },
		]);
		expect(yTicks(container)).toEqual(['0.0', '0.2', '0.4', '0.6', '0.8', '1.0']);
	});

	it('draws a line at 0 across the plot when a total is below 0', () => {
		const container = document.getElementById('bar');

		renderBarChart(container, MIXED_ROWS, 'team', SUM);

		const [a] = bars(container);
		const line = container.querySelector('.bar-zero-line');
		expect(line).not.toBeNull();
		expect(Number(line.getAttribute('y1'))).toBe(a.y + a.height);
		expect(Number(line.getAttribute('y2'))).toBe(a.y + a.height);
		expect([line.getAttribute('x1'), line.getAttribute('x2')]).toEqual(['0', '636']);
	});

	it('draws no separate line at 0 when 0 is at the bottom of the plot', () => {
		const container = document.getElementById('bar');

		renderBarChart(container, [{ team: 'A' }, { team: 'A' }, { team: 'B' }], 'team');
		expect(container.querySelector('.bar-zero-line')).toBeNull();

		renderBarChart(container, [{ team: 'A', profit: 0 }, { team: 'B', profit: 0 }], 'team', SUM);
		expect(container.querySelector('.bar-zero-line')).toBeNull();
	});

	it.each([
		['some totals are', MIXED_ROWS],
		['every total is', NEGATIVE_ROWS],
	])('leaves the percentage out of the tooltip when %s below 0', (_, rows) => {
		const container = document.getElementById('bar');

		renderBarChart(container, rows, 'team', SUM);

		for (const rect of container.querySelectorAll('rect')) {
			const text = tooltipText(rect);
			expect(text).toContain('Sum');
			expect(text).not.toContain('Percentage');
		}
	});

	it('keeps the percentage in the tooltip when no total is below 0', () => {
		const container = document.getElementById('bar');
		const rows = [
			{ team: 'A', profit: 5 },
			{ team: 'B', profit: 0 },
			{ team: 'C', profit: 3 },
		];

		renderBarChart(container, rows, 'team', SUM);

		const text = tooltipText(container.querySelector('rect'));
		expect(text).toContain('Percentage');
		expect(text).toContain('62.5%');
	});
});
