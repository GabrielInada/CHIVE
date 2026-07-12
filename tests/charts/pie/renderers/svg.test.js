// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderPieChart } from '../../../../src/charts/pie/renderers/svg.js';
import { hideChartTooltip } from '../../../../src/charts/shared/tooltip/tooltip.js';

describe('renderPieChart behavior', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="pie"></div>';
	});

	afterEach(() => {
		hideChartTooltip();
	});

	it('renders pie chart with valid defaults and custom color base', () => {
		const container = document.getElementById('pie');
		const rows = [
			{ categoria: 'A' },
			{ categoria: 'B' },
			{ categoria: 'A' },
			{ categoria: 'C' },
		];

		const result = renderPieChart(container, rows, 'categoria', {
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
		const rows = [
			{ categoria: 'A', valor: 10 },
			{ categoria: 'A', valor: 5 },
			{ categoria: 'B', valor: 7 },
			{ categoria: 'C', valor: 3 },
		];

		const result = renderPieChart(container, rows, 'categoria', {
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
		const rows = [
			{ categoria: 'A' },
			{ categoria: 'B' },
			{ categoria: 'A' },
		];

		const result = renderPieChart(container, rows, 'categoria', {
			zoomScale: 1.8,
		});

		expect(result.ok).toBe(true);
		const svg = container.querySelector('svg');
		const viewport = svg?.querySelector('g');
		expect(viewport?.getAttribute('transform') || '').toContain('scale(1.8)');
	});

	it('hides outside labels for tiny slices while keeping legend entries visible', () => {
		const container = document.getElementById('pie');
		const rows = [];
		for (let index = 0; index < 98; index += 1) {
			rows.push({ categoria: 'Major' });
		}
		rows.push({ categoria: 'TinyA' });
		rows.push({ categoria: 'TinyB' });

		const result = renderPieChart(container, rows, 'categoria', {
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
		const rows = [];
		['A', 'A', 'A', 'A', 'B', 'B', 'B', 'C', 'C', 'D', 'E', 'F'].forEach(c => rows.push({ categoria: c }));

		const result = renderPieChart(container, rows, 'categoria', {
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
		const rows = [];
		['A', 'A', 'A', 'A', 'B', 'B', 'B', 'C', 'C', 'D', 'E', 'F'].forEach(c => rows.push({ categoria: c }));

		const result = renderPieChart(container, rows, 'categoria', {
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
		const rows = [
			{ categoria: 'A' },
			{ categoria: 'B' },
			{ categoria: 'C' },
			{ categoria: 'D' },
		];

		const result = renderPieChart(container, rows, 'categoria', { topN: 0 });
		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('path').length).toBe(4);
	});

	it('returns explicit failure reason for sum mode without valid numeric column', () => {
		const container = document.getElementById('pie');
		const rows = [
			{ categoria: 'A', valor: 'x' },
			{ categoria: 'B', valor: 'y' },
		];

		const result = renderPieChart(container, rows, 'categoria', {
			measureMode: 'sum',
			valueColumn: 'valor',
		});

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('sum-no-numeric');
	});

	it('covers pie invalid args, hidden labels/legend, custom slice colors, and invalid radius options', () => {
		const container = document.getElementById('pie');
		expect(renderPieChart(null, [], 'categoria').ok).toBe(false);
		expect(renderPieChart(container, [], '').ok).toBe(false);

		const result = renderPieChart(container, [
			{ categoria: 'A' },
			{ categoria: 'B' },
			{ categoria: 'A' },
		], 'categoria', {
			color: 'bad-color',
			customSliceColors: { A: '#123456' },
			showCategoryLabel: false,
			showValueLabel: false,
			showLegend: false,
			labelPosition: 'unknown',
			innerRadius: Number.NaN,
			outerRadius: Number.NaN,
			padAngle: Number.NaN,
			zoomScale: 99,
			chartHeight: 100,
		});

		expect(result.ok).toBe(true);
		expect(container.querySelector('path')?.getAttribute('fill')).toBe('#123456');
		expect(container.querySelector('.pie-legend')).toBeNull();
		expect(container.querySelectorAll('text').length).toBe(0);
	});

	it('covers pie Other-slice pinned tooltip without filter actions and included/excluded filter states', () => {
		const container = document.getElementById('pie');
		const rows = ['A', 'A', 'B', 'C', 'D'].map(categoria => ({ categoria }));
		let result = renderPieChart(container, rows, 'categoria', {
			topN: 1,
			topNMode: 'other',
			labels: { other: 'Other' },
			filterCallbacks: {
				onFocusGlobalFilter: () => {},
				onAddToGlobalFilter: () => {},
				onExcludeGlobalFilter: () => {},
				getTokenFilterState: () => null,
			},
		});
		expect(result.ok).toBe(true);
		const otherSlice = Array.from(container.querySelectorAll('path')).find(path => path.__data__?.data?.isOther);
		otherSlice.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		expect(document.querySelectorAll('.chart-tooltip__action').length).toBe(0);

		result = renderPieChart(container, rows, 'categoria', {
			filterCallbacks: {
				onRemoveFromGlobalFilter: () => {},
				getTokenFilterState: () => 'included',
				filterActionLabels: { stateIncluded: 'Included', remove: 'Remove' },
			},
		});
		expect(result.ok).toBe(true);
		container.querySelector('path').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		expect(document.querySelector('.chart-tooltip__filter-state--included')).not.toBeNull();

		result = renderPieChart(container, rows, 'categoria', {
			filterCallbacks: {
				onBringBackGlobalFilter: () => {},
				getTokenFilterState: () => 'excluded',
				filterActionLabels: { stateExcluded: 'Excluded', bringBack: 'Bring back' },
			},
		});
		expect(result.ok).toBe(true);
		container.querySelector('path').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		expect(document.querySelector('.chart-tooltip__filter-state--excluded')).not.toBeNull();
	});
});
