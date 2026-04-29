// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { renderBarChart } from '../../../src/modules/visualizations/barChart.js';
import { renderPieChart } from '../../../src/modules/visualizations/pieChart.js';
import { renderScatterPlot } from '../../../src/modules/visualizations/scatterPlot.js';

describe('pie chart and axis labels', () => {
	beforeEach(() => {
		document.body.innerHTML = [
			'<div id="bar"></div>',
			'<div id="scatter"></div>',
			'<div id="pie"></div>',
		].join('');
	});

	it('renders pie chart with valid defaults and custom color base', () => {
		const container = document.getElementById('pie');
		const dados = [
			{ categoria: 'A' },
			{ categoria: 'B' },
			{ categoria: 'A' },
			{ categoria: 'C' },
		];

		const result = renderPieChart(container, dados, 'categoria', {
			color: '#336699',
			innerRadius: 24,
			outerRadius: 80,
		});

		expect(result.ok).toBe(true);
		const slices = container.querySelectorAll('path');
		expect(slices.length).toBeGreaterThan(0);
		expect(slices[0].getAttribute('fill')).toBe('#336699');
	});

	it('supports pie sum mode with legend and outside labels', () => {
		const container = document.getElementById('pie');
		const dados = [
			{ categoria: 'A', valor: 10 },
			{ categoria: 'A', valor: 5 },
			{ categoria: 'B', valor: 7 },
			{ categoria: 'C', valor: 3 },
		];

		const result = renderPieChart(container, dados, 'categoria', {
			measureMode: 'sum',
			valueColumn: 'valor',
			showLegend: true,
			labelPosition: 'outside',
			padAngle: 4,
		});

		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('polyline').length).toBeGreaterThan(0);
		expect(container.textContent).toContain('A (15)');
	});

	it('applies initial zoom scale to pie viewport', () => {
		const container = document.getElementById('pie');
		const dados = [
			{ categoria: 'A' },
			{ categoria: 'B' },
			{ categoria: 'A' },
		];

		const result = renderPieChart(container, dados, 'categoria', {
			zoomScale: 1.8,
		});

		expect(result.ok).toBe(true);
		const svg = container.querySelector('svg');
		const viewport = svg?.querySelector('g');
		expect(viewport?.getAttribute('transform') || '').toContain('scale(1.8)');
	});

	it('hides outside labels for tiny slices while keeping legend entries visible', () => {
		const container = document.getElementById('pie');
		const dados = [];
		for (let index = 0; index < 98; index += 1) {
			dados.push({ categoria: 'Major' });
		}
		dados.push({ categoria: 'TinyA' });
		dados.push({ categoria: 'TinyB' });

		const result = renderPieChart(container, dados, 'categoria', {
			labelPosition: 'outside',
			showLegend: true,
		});

		expect(result.ok).toBe(true);
		const outsideLabels = Array.from(container.querySelectorAll('text.pie-outside-label')).map(node => node.textContent);
		expect(outsideLabels.join(' ')).not.toContain('TinyA');
		expect(outsideLabels.join(' ')).not.toContain('TinyB');
		expect(container.textContent).toContain('TinyA (1)');
		expect(container.textContent).toContain('TinyB (1)');
	});

	it('aggregates remaining categories into Other when topN is set with mode "other"', () => {
		const container = document.getElementById('pie');
		const dados = [];
		['A', 'A', 'A', 'A', 'B', 'B', 'B', 'C', 'C', 'D', 'E', 'F'].forEach(c => dados.push({ categoria: c }));

		const result = renderPieChart(container, dados, 'categoria', {
			topN: 2,
			topNMode: 'other',
			showLegend: true,
			labels: { other: 'Outros' },
		});

		expect(result.ok).toBe(true);
		expect(container.textContent).toContain('A (4)');
		expect(container.textContent).toContain('B (3)');
		expect(container.textContent).toContain('Outros (5)');
		const slices = container.querySelectorAll('path');
		expect(slices.length).toBe(3);
	});

	it('truncates remaining categories when topN mode is "truncate"', () => {
		const container = document.getElementById('pie');
		const dados = [];
		['A', 'A', 'A', 'A', 'B', 'B', 'B', 'C', 'C', 'D', 'E', 'F'].forEach(c => dados.push({ categoria: c }));

		const result = renderPieChart(container, dados, 'categoria', {
			topN: 2,
			topNMode: 'truncate',
			showLegend: true,
		});

		expect(result.ok).toBe(true);
		const slices = container.querySelectorAll('path');
		expect(slices.length).toBe(2);
		expect(container.textContent).not.toContain('Other');
		expect(container.textContent).not.toContain('Outros');
		expect(container.textContent).toContain('A (4)');
		expect(container.textContent).toContain('B (3)');
	});

	it('does not change behavior when topN is 0 (all categories)', () => {
		const container = document.getElementById('pie');
		const dados = [
			{ categoria: 'A' },
			{ categoria: 'B' },
			{ categoria: 'C' },
			{ categoria: 'D' },
		];

		const result = renderPieChart(container, dados, 'categoria', { topN: 0 });
		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('path').length).toBe(4);
	});

	it('returns explicit failure reason for sum mode without valid numeric column', () => {
		const container = document.getElementById('pie');
		const dados = [
			{ categoria: 'A', valor: 'x' },
			{ categoria: 'B', valor: 'y' },
		];

		const result = renderPieChart(container, dados, 'categoria', {
			measureMode: 'sum',
			valueColumn: 'valor',
		});

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('sum-no-numeric');
	});

	it('supports bar chart sum and mean measure modes with numeric value column', () => {
		const container = document.getElementById('bar');
		const dados = [
			{ categoria: 'A', valor: 10 },
			{ categoria: 'A', valor: 20 },
			{ categoria: 'B', valor: 30 },
		];

		const sumResult = renderBarChart(container, dados, 'categoria', {
			measureMode: 'sum',
			valueColumn: 'valor',
		});
		expect(sumResult.ok).toBe(true);

		const meanResult = renderBarChart(container, dados, 'categoria', {
			measureMode: 'mean',
			valueColumn: 'valor',
		});
		expect(meanResult.ok).toBe(true);
	});

	it('renders pinned bar tooltip actions for focus and add-to-filter', () => {
		const container = document.getElementById('bar');
		const calls = { focus: [], add: [] };
		const dados = [
			{ categoria: 'A' },
			{ categoria: 'A' },
			{ categoria: 'B' },
		];

		const result = renderBarChart(container, dados, 'categoria', {
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
		const dados = [
			{ categoria: 'A' },
			{ categoria: 'A' },
			{ categoria: 'B' },
		];

		const result = renderBarChart(container, dados, 'categoria', {
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
		const dados = [
			{ categoria: 'A' },
			{ categoria: 'B' },
		];

		const result = renderBarChart(container, dados, 'categoria', {
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
		// no "Show only this" — only [Add, Hide]
		expect(buttons).toHaveLength(2);
		expect(buttons[0].className).not.toContain('chart-tooltip__action--primary');
	});

	it('shows an "in filter" state badge and Remove action when token is already included', () => {
		const container = document.getElementById('bar');
		const calls = { focus: [], remove: [] };
		const dados = [
			{ categoria: 'A' },
			{ categoria: 'B' },
		];

		const result = renderBarChart(container, dados, 'categoria', {
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
		const dados = [
			{ categoria: 'A', valor: 'x' },
			{ categoria: 'B', valor: 'y' },
		];

		const noColumnResult = renderBarChart(container, dados, 'categoria', {
			measureMode: 'sum',
			valueColumn: 'inexistente',
		});
		expect(noColumnResult.ok).toBe(false);
		expect(noColumnResult.reason).toBe('no-value-column');

		const noNumericResult = renderBarChart(container, dados, 'categoria', {
			measureMode: 'sum',
			valueColumn: 'valor',
		});
		expect(noNumericResult.ok).toBe(false);
		expect(noNumericResult.reason).toBe('no-numeric');
	});

	it('supports toggling axis labels in bar and scatter charts', () => {
		const barContainer = document.getElementById('bar');
		const scatterContainer = document.getElementById('scatter');

		const barData = [
			{ categoria: 'A' },
			{ categoria: 'A' },
			{ categoria: 'B' },
		];
		const scatterData = [
			{ x: 1, y: 2 },
			{ x: 3, y: 4 },
			{ x: 5, y: 6 },
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

		renderScatterPlot(scatterContainer, scatterData, 'x', 'y', {
			showXAxisLabel: false,
			showYAxisLabel: true,
			axisLabels: {
				x: 'Scatter Axis X Custom',
				y: 'Scatter Axis Y Custom',
			},
		});
		expect(scatterContainer.textContent).not.toContain('Scatter Axis X Custom');
		expect(scatterContainer.textContent).toContain('Scatter Axis Y Custom');
	});
});
