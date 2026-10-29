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

	it('draws each slice of a pie with more than 9 slices in its own color', () => {
		const container = document.getElementById('pie');
		// C01 to C12 with 12 down to 1 rows each.
		const rows = Array.from({ length: 12 }, (_, index) => Array.from(
			{ length: 12 - index },
			() => ({ categoria: `C${String(index + 1).padStart(2, '0')}` }),
		)).flat();

		renderPieChart(container, rows, 'categoria', { color: '#5f7c33' });

		const fills = Array.from(container.querySelectorAll('path'), path => path.getAttribute('fill'));
		expect(fills).toHaveLength(12);
		expect(new Set(fills).size).toBe(12);
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
		expect(result.reason).toBe('no-numeric');
	});

	it('draws only categories whose total is above 0, each with its share of the circle', () => {
		const container = document.getElementById('pie');
		const rows = [
			{ categoria: 'A', valor: 5 },
			{ categoria: 'B', valor: -3 },
			{ categoria: 'C', valor: 2 },
		];
		const share = slice => {
			slice.dispatchEvent(new MouseEvent('mouseenter'));
			return document.querySelector('.chart-tooltip').textContent;
		};

		const result = renderPieChart(container, rows, 'categoria', {
			measureMode: 'sum',
			valueColumn: 'valor',
			showLegend: true,
		});

		expect(result.ok).toBe(true);
		const slices = Array.from(container.querySelectorAll('path'));
		expect(slices.map(path => path.__data__.data.key)).toEqual(['A', 'C']);
		expect(container.textContent).not.toContain('B (');
		expect(share(slices[0])).toContain('71.4%');
		expect(share(slices[1])).toContain('28.6%');
	});

	it('returns no-positive-value and draws nothing when no total is above 0', () => {
		const container = document.getElementById('pie');
		const rows = [
			{ categoria: 'A', valor: -5 },
			{ categoria: 'B', valor: -3 },
		];

		const result = renderPieChart(container, rows, 'categoria', {
			measureMode: 'sum',
			valueColumn: 'valor',
		});

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('no-positive-value');
		expect(container.querySelector('svg')).toBeNull();
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

	it('pins the Other sector after a real category spelled the same way', () => {
		const container = document.getElementById('pie');
		const rows = ['Other', 'Other', 'Other', 'A', 'A', 'B', 'C'].map(categoria => ({ categoria }));
		renderPieChart(container, rows, 'categoria', { topN: 2, topNMode: 'other', labels: { other: 'Other' } });
		const slices = Array.from(container.querySelectorAll('path'));
		const realOther = slices.find(path => path.__data__.data.key === 'Other');
		const otherSector = slices.find(path => path.__data__.data.isOther);

		realOther.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		otherSector.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

		// The second click pins the Other sector (2 of 7 rows) instead of
		// unpinning the real category (3 of 7).
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip.hidden).toBe(false);
		expect(tooltip.textContent).toContain('28.6%');
		expect(tooltip.textContent).not.toContain('42.9%');
	});

	it('labels the tooltip value Sum in sum mode and Count in count mode', () => {
		const container = document.getElementById('pie');
		// A has two rows that sum to 8.
		const rows = [
			{ categoria: 'A', valor: 6 },
			{ categoria: 'A', valor: 2 },
			{ categoria: 'B', valor: 3 },
			{ categoria: 'C', valor: 1 },
		];
		const hoverA = () => {
			const slice = Array.from(container.querySelectorAll('path')).find(path => path.__data__.data.key === 'A');
			slice.dispatchEvent(new MouseEvent('mouseenter'));
			return document.querySelector('.chart-tooltip').textContent;
		};

		renderPieChart(container, rows, 'categoria', { measureMode: 'sum', valueColumn: 'valor' });
		expect(hoverA()).toContain('Sum: 8');

		renderPieChart(container, rows, 'categoria', { measureMode: 'count' });
		expect(hoverA()).toContain('Count: 2');
	});

	it('offers filter actions for a category sector and none for the Other sector', () => {
		const container = document.getElementById('pie');
		const rows = ['A', 'A', 'B', 'C', 'D'].map(categoria => ({ categoria }));
		const calls = [];
		const result = renderPieChart(container, rows, 'categoria', {
			topN: 1,
			topNMode: 'other',
			labels: { other: 'Other' },
			filterCallbacks: {
				onAddToGlobalFilter: (column, token) => calls.push([column, token]),
			},
		});
		expect(result.ok).toBe(true);
		const sectors = Array.from(container.querySelectorAll('path')).filter(path => path.__data__?.data);

		sectors.find(path => path.__data__.data.key === 'A')
			.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		document.querySelector('.chart-tooltip__action').click();
		expect(calls).toEqual([['categoria', 'v:A']]);

		sectors.find(path => path.__data__.data.isOther)
			.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		expect(document.querySelector('.chart-tooltip').classList.contains('chart-tooltip--fixado')).toBe(true);
		expect(document.querySelectorAll('.chart-tooltip__action')).toHaveLength(0);
	});
});
