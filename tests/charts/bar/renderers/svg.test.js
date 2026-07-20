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
