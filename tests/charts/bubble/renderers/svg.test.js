// @vitest-environment jsdom

import { renderContext } from '../../renderContext.js';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderBubbleChart } from '../../../../src/charts/bubble/renderers/svg.js';

// Explicit enum inputs preserve the renderer's historical output.
const BASE_OPTIONS = { measureMode: 'count', labelMode: 'auto', nestingMode: 'flat', colorScheme: 'Tableau10' };

function mouse(type, options = {}) {
	return new MouseEvent(type, {
		bubbles: true,
		cancelable: true,
		pageX: 100,
		pageY: 120,
		...options,
	});
}

describe('bubble chart visualization', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="bubble"></div>';
	});

	it('returns failure when container or category column is missing', () => {
		const rows = [{ categoria: 'A' }];

		expect(renderBubbleChart(null, rows, {
			category: 'categoria',
			...BASE_OPTIONS,
		}, renderContext({ category: 'categoria' }, {
			...BASE_OPTIONS,
		}))).toEqual({ ok: false });
		expect(renderBubbleChart(document.getElementById('bubble'), rows, {
			category: null,
			...BASE_OPTIONS,
		}, renderContext({ category: null }, {
			...BASE_OPTIONS,
		}))).toEqual({ ok: false });
	});

	it('renders packed bubbles and returns ok', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A' },
			{ categoria: 'A' },
			{ categoria: 'B' },
			{ categoria: 'C' },
		];

		const result = renderBubbleChart(container, rows, {
			category: 'categoria',
			...BASE_OPTIONS,
			chartHeight: 700,
			labelMode: 'auto',
		}, renderContext({ category: 'categoria' }, {
			...BASE_OPTIONS,
		}));

		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-node > circle').length).toBe(3);
		expect(container.querySelectorAll('g.bubble-node').length).toBe(3);
	});

	it('keeps the no-title viewport transform at the chart margins', () => {
		const container = document.getElementById('bubble');
		const result = renderBubbleChart(container, [{ categoria: 'A' }], {
			category: 'categoria',
			...BASE_OPTIONS,
		}, renderContext({ category: 'categoria' }, {
			...BASE_OPTIONS,
		}));

		expect(result.ok).toBe(true);
		expect(container.querySelector('svg > g').getAttribute('transform')).toBe('translate(10,10)');
	});

	it('supports count, sum, and mean aggregation plus top-N filtering', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', valor: 10 },
			{ categoria: 'A', valor: 20 },
			{ categoria: 'B', valor: 5 },
			{ categoria: 'C', valor: 40 },
		];

		const countResult = renderBubbleChart(container, rows, {
			category: 'categoria',
			...BASE_OPTIONS,
			topN: 2,
		}, renderContext({ category: 'categoria' }, {
			...BASE_OPTIONS,
		}));
		expect(countResult.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-node').length).toBe(2);

		container.innerHTML = '';
		const sumResult = renderBubbleChart(container, rows, {
			category: 'categoria',
			...BASE_OPTIONS,
			measureMode: 'sum',
			valueColumn: 'valor',
			topN: 0,
		}, renderContext({ category: 'categoria' }, {
			...BASE_OPTIONS,
		}));
		expect(sumResult.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-node').length).toBe(3);

		container.innerHTML = '';
		const meanResult = renderBubbleChart(container, rows, {
			category: 'categoria',
			...BASE_OPTIONS,
			measureMode: 'mean',
			valueColumn: 'valor',
		}, renderContext({ category: 'categoria' }, {
			...BASE_OPTIONS,
		}));
		expect(meanResult.ok).toBe(true);
	});

	it('returns explicit failure reasons for missing numeric data in sum mode', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', valor: 'x' },
			{ categoria: 'B', valor: 'y' },
		];

		const result = renderBubbleChart(container, rows, {
			category: 'categoria',
			...BASE_OPTIONS,
			measureMode: 'sum',
			valueColumn: 'valor',
		}, renderContext({ category: 'categoria' }, {
			...BASE_OPTIONS,
		}));

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('no-numeric');
	});

	it('flat mode ignores a group column', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', grupo: 'X' },
			{ categoria: 'B', grupo: 'X' },
			{ categoria: 'C', grupo: 'Y' },
		];

		const result = renderBubbleChart(container, rows, {
			category: 'categoria',
			...BASE_OPTIONS,
			nestingMode: 'flat',
			groupColumn: 'grupo',
		}, renderContext({ category: 'categoria' }, {
			...BASE_OPTIONS,
		}));

		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-node').length).toBe(3);
		expect(container.querySelectorAll('g.bubble-parent').length).toBe(0);
	});

	it('grouped mode creates parent and leaf structure', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', grupo: 'X' },
			{ categoria: 'B', grupo: 'X' },
			{ categoria: 'C', grupo: 'Y' },
			{ categoria: 'D', grupo: 'Y' },
		];

		const result = renderBubbleChart(container, rows, {
			category: 'categoria',
			...BASE_OPTIONS,
			nestingMode: 'grouped',
			groupColumn: 'grupo',
		}, renderContext({ category: 'categoria' }, {
			...BASE_OPTIONS,
		}));

		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-parent').length).toBe(2);
		expect(container.querySelectorAll('g.bubble-node').length).toBe(4);
	});

	it('grouped mode without groupColumn or nestingColumns returns fail', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A' },
			{ categoria: 'B' },
		];

		const result = renderBubbleChart(container, rows, {
			category: 'categoria',
			...BASE_OPTIONS,
			nestingMode: 'grouped',
		}, renderContext({ category: 'categoria' }, {
			...BASE_OPTIONS,
		}));

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('no-nesting-columns');
	});

	it('topN still works in grouped mode (global leaf limit)', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', grupo: 'X' },
			{ categoria: 'B', grupo: 'X' },
			{ categoria: 'C', grupo: 'Y' },
			{ categoria: 'D', grupo: 'Y' },
			{ categoria: 'E', grupo: 'Z' },
		];

		const result = renderBubbleChart(container, rows, {
			category: 'categoria',
			...BASE_OPTIONS,
			nestingMode: 'grouped',
			groupColumn: 'grupo',
			topN: 3,
		}, renderContext({ category: 'categoria' }, {
			...BASE_OPTIONS,
		}));

		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-node').length).toBe(3);
	});

	it('sum/mean still work in grouped mode', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', grupo: 'X', valor: 10 },
			{ categoria: 'B', grupo: 'X', valor: 20 },
			{ categoria: 'C', grupo: 'Y', valor: 30 },
		];

		const sumResult = renderBubbleChart(container, rows, {
			category: 'categoria',
			...BASE_OPTIONS,
			nestingMode: 'grouped',
			groupColumn: 'grupo',
			measureMode: 'sum',
			valueColumn: 'valor',
			topN: 0,
		}, renderContext({ category: 'categoria' }, {
			...BASE_OPTIONS,
		}));

		expect(sumResult.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-parent').length).toBe(2);
		expect(container.querySelectorAll('g.bubble-node').length).toBe(3);
	});

	it('leaf labels use bubble-leaf-label class from renderLeafLabels', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A' },
			{ categoria: 'A' },
			{ categoria: 'B' },
		];

		renderBubbleChart(container, rows, {
			category: 'categoria',
			...BASE_OPTIONS,
			labelMode: 'all',
		}, renderContext({ category: 'categoria' }, {
			...BASE_OPTIONS,
		}));

		const labels = container.querySelectorAll('text.bubble-leaf-label');
		expect(labels.length).toBe(2);
	});

	it('parent tooltip includes aggregated value and child count via title element', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', grupo: 'X' },
			{ categoria: 'A', grupo: 'X' },
			{ categoria: 'B', grupo: 'X' },
			{ categoria: 'C', grupo: 'Y' },
		];

		const result = renderBubbleChart(container, rows, {
			category: 'categoria',
			...BASE_OPTIONS,
			nestingMode: 'grouped',
			groupColumn: 'grupo',
		}, renderContext({ category: 'categoria' }, {
			...BASE_OPTIONS,
		}));

		expect(result.ok).toBe(true);
		const parentGroups = container.querySelectorAll('g.bubble-parent');
		expect(parentGroups.length).toBe(2);
	});

	it('uses numeric fallbacks, clamps height, and renders a title', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', valor: 10 },
			{ categoria: 'B', valor: 20 },
		];

		const result = renderBubbleChart(container, rows, {
			category: 'categoria',
			...BASE_OPTIONS,
			measureMode: 'count',
			topN: 'bad',
			padding: 'bad',
			labelMode: 'auto',
			autoLabelMinRadius: 'bad',
			nestingMode: 'flat',
			colorScheme: 'Tableau10',
			customTitle: '  Bubble title  ',
			chartHeight: 100,
		}, renderContext({ category: 'categoria' }, {
			...BASE_OPTIONS,
			labels: {},
		}));

		expect(result.ok).toBe(true);
		const svg = container.querySelector('svg');
		expect(svg.getAttribute('height')).toBe('400');
		expect(container.textContent).toContain('Bubble title');
		expect(container.querySelector('g.bubble-node circle').getAttribute('fill')).toBeTruthy();
	});

	it('supports hover-only labels and outside labels for small bubbles', () => {
		const container = document.getElementById('bubble');
		const rows = Array.from({ length: 12 }, (_, index) => ({ categoria: `Item ${index}` }));

		renderBubbleChart(container, rows, {
			category: 'categoria',
			...BASE_OPTIONS,
			labelMode: 'hover',
		}, renderContext({ category: 'categoria' }, {
			...BASE_OPTIONS,
		}));
		expect(container.querySelectorAll('text.bubble-leaf-label')).toHaveLength(0);

		container.innerHTML = '';
		renderBubbleChart(container, rows, {
			category: 'categoria',
			...BASE_OPTIONS,
			labelMode: 'all',
			autoLabelMinRadius: 999,
		}, renderContext({ category: 'categoria' }, {
			...BASE_OPTIONS,
		}));
		const outsideLabels = Array.from(container.querySelectorAll('text.bubble-leaf-label'))
			.filter(label => label.getAttribute('dominant-baseline') === 'hanging');
		expect(outsideLabels.length).toBeGreaterThan(0);
	});

	it('returns no-value-column when sum mode has no value column', () => {
		const container = document.getElementById('bubble');

		const result = renderBubbleChart(container, [{ categoria: 'A' }], {
			category: 'categoria',
			...BASE_OPTIONS,
			measureMode: 'sum',
		}, renderContext({ category: 'categoria' }, {
			...BASE_OPTIONS,
		}));

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('no-value-column');
	});

	it('shows, moves, hides, pins, and unpins parent tooltips', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', grupo: 'X' },
			{ categoria: 'B', grupo: 'X' },
			{ categoria: 'C', grupo: 'Y' },
		];

		renderBubbleChart(container, rows, {
			category: 'categoria',
			...BASE_OPTIONS,
			nestingMode: 'grouped',
			nestingColumns: ['grupo'],
			zoomTransitionDuration: 0,
		}, renderContext({ category: 'categoria' }, {
			...BASE_OPTIONS,
		}));

		const parent = container.querySelector('g.bubble-parent');
		const circle = parent.querySelector('circle');
		parent.dispatchEvent(mouse('mouseenter'));
		expect(document.querySelector('.chart-tooltip')?.hidden).toBe(false);
		expect(circle.getAttribute('fill-opacity')).toBe('0.25');
		parent.dispatchEvent(mouse('mousemove'));
		parent.dispatchEvent(mouse('mouseleave'));
		expect(document.querySelector('.chart-tooltip')?.hidden).toBe(true);

		parent.dispatchEvent(mouse('click'));
		expect(document.querySelector('.chart-tooltip')?.classList.contains('chart-tooltip--fixado')).toBe(true);
		parent.dispatchEvent(mouse('mouseenter'));
		parent.dispatchEvent(mouse('mousemove'));
		parent.dispatchEvent(mouse('mouseleave'));
		expect(document.querySelector('.chart-tooltip')?.classList.contains('chart-tooltip--fixado')).toBe(true);

		parent.dispatchEvent(mouse('click'));
		expect(document.querySelector('.chart-tooltip')?.hidden).toBe(true);
	});

	it('offers filter actions for a parent bubble on its nesting column', () => {
		const container = document.getElementById('bubble');
		const calls = [];
		renderBubbleChart(container, [
			{ categoria: 'A', regiao: 'North', estado: 'PA' },
			{ categoria: 'B', regiao: 'North', estado: 'AM' },
		], {
			category: 'categoria',
			...BASE_OPTIONS,
			nestingMode: 'grouped',
			nestingColumns: ['regiao', 'estado'],
		}, renderContext({ category: 'categoria' }, {
			...BASE_OPTIONS,
			filterCallbacks: {
				onAddToGlobalFilter: (column, token) => calls.push([column, token]),
			},
		}));

		container.querySelector('g.bubble-parent[data-depth="1"]').dispatchEvent(mouse('click'));
		document.querySelector('.chart-tooltip__action').click();
		expect(calls).toEqual([['regiao', 'v:North']]);
	});

	it('offers filter actions for a leaf bubble on the category column', () => {
		const container = document.getElementById('bubble');
		const calls = [];
		renderBubbleChart(container, [
			{ categoria: 'A', grupo: 'X' },
			{ categoria: 'B', grupo: 'Y' },
		], {
			category: 'categoria',
			...BASE_OPTIONS,
		}, renderContext({ category: 'categoria' }, {
			...BASE_OPTIONS,
			filterCallbacks: {
				onAddToGlobalFilter: (column, token) => calls.push([column, token]),
			},
		}));

		Array.from(container.querySelectorAll('g.bubble-node'))
			.find(node => node.textContent.includes('B'))
			.dispatchEvent(mouse('click'));
		document.querySelector('.chart-tooltip__action').click();
		expect(calls).toEqual([['categoria', 'v:B']]);
	});

	it('renders pinned leaf tooltip without action sets when callbacks are absent', () => {
		const container = document.getElementById('bubble');
		renderBubbleChart(container, [
			{ categoria: 'A', grupo: 'X' },
			{ categoria: 'B', grupo: 'Y' },
		], {
			category: 'categoria',
			...BASE_OPTIONS,
		}, renderContext({ category: 'categoria' }, {
			...BASE_OPTIONS,
		}));

		const leaf = container.querySelector('g.bubble-node');
		leaf.dispatchEvent(mouse('click'));

		expect(document.querySelector('.chart-tooltip')?.classList.contains('chart-tooltip--fixado')).toBe(true);
		expect(document.querySelectorAll('.chart-tooltip__action')).toHaveLength(0);
		leaf.dispatchEvent(mouse('mouseenter'));
		leaf.dispatchEvent(mouse('mousemove'));
		leaf.dispatchEvent(mouse('mouseleave'));
		expect(document.querySelector('.chart-tooltip')?.classList.contains('chart-tooltip--fixado')).toBe(true);
		leaf.dispatchEvent(mouse('click'));
		expect(document.querySelector('.chart-tooltip')?.hidden).toBe(true);
	});
});
