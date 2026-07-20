// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { renderBubbleChart } from '../../../../src/charts/bubble/renderers/svg.js';

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

		expect(renderBubbleChart(null, rows, 'categoria')).toEqual({ ok: false });
		expect(renderBubbleChart(document.getElementById('bubble'), rows, null)).toEqual({ ok: false });
	});

	it('renders packed bubbles and returns ok', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A' },
			{ categoria: 'A' },
			{ categoria: 'B' },
			{ categoria: 'C' },
		];

		const result = renderBubbleChart(container, rows, 'categoria', {
			chartHeight: 700,
			labelMode: 'auto',
		});

		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-node > circle').length).toBe(3);
		expect(container.querySelectorAll('g.bubble-node').length).toBe(3);
	});

	it('keeps the no-title viewport transform at the chart margins', () => {
		const container = document.getElementById('bubble');
		const result = renderBubbleChart(container, [{ categoria: 'A' }], 'categoria');

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

		const countResult = renderBubbleChart(container, rows, 'categoria', { topN: 2 });
		expect(countResult.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-node').length).toBe(2);

		container.innerHTML = '';
		const sumResult = renderBubbleChart(container, rows, 'categoria', {
			measureMode: 'sum',
			valueColumn: 'valor',
			topN: 0,
		});
		expect(sumResult.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-node').length).toBe(3);

		container.innerHTML = '';
		const meanResult = renderBubbleChart(container, rows, 'categoria', {
			measureMode: 'mean',
			valueColumn: 'valor',
		});
		expect(meanResult.ok).toBe(true);
	});

	it('returns explicit failure reasons for missing numeric data in sum mode', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', valor: 'x' },
			{ categoria: 'B', valor: 'y' },
		];

		const result = renderBubbleChart(container, rows, 'categoria', {
			measureMode: 'sum',
			valueColumn: 'valor',
		});

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('no-numeric');
	});

	it('flat mode unchanged when nestingMode is flat or omitted', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', grupo: 'X' },
			{ categoria: 'B', grupo: 'X' },
			{ categoria: 'C', grupo: 'Y' },
		];

		const result = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'flat',
			groupColumn: 'grupo',
		});

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

		const result = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
			groupColumn: 'grupo',
		});

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

		const result = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
		});

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

		const result = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
			groupColumn: 'grupo',
			topN: 3,
		});

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

		const sumResult = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
			groupColumn: 'grupo',
			measureMode: 'sum',
			valueColumn: 'valor',
			topN: 0,
		});

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

		renderBubbleChart(container, rows, 'categoria', {
			labelMode: 'all',
		});

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

		const result = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
			groupColumn: 'grupo',
		});

		expect(result.ok).toBe(true);
		const parentGroups = container.querySelectorAll('g.bubble-parent');
		expect(parentGroups.length).toBe(2);
	});

	it('uses fallback options, clamps height, renders title, and falls back to the default palette', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', valor: 10 },
			{ categoria: 'B', valor: 20 },
		];

		const result = renderBubbleChart(container, rows, 'categoria', {
			measureMode: 'unknown',
			topN: 'bad',
			padding: 'bad',
			labelMode: 'bad',
			autoLabelMinRadius: 'bad',
			nestingMode: 'bad',
			colorScheme: 'Missing',
			customTitle: '  Bubble title  ',
			chartHeight: 100,
			labels: {},
		});

		expect(result.ok).toBe(true);
		const svg = container.querySelector('svg');
		expect(svg.getAttribute('height')).toBe('400');
		expect(container.textContent).toContain('Bubble title');
		expect(container.querySelector('g.bubble-node circle').getAttribute('fill')).toBeTruthy();
	});

	it('supports hover-only labels and outside labels for small bubbles', () => {
		const container = document.getElementById('bubble');
		const rows = Array.from({ length: 12 }, (_, index) => ({ categoria: `Item ${index}` }));

		renderBubbleChart(container, rows, 'categoria', { labelMode: 'hover' });
		expect(container.querySelectorAll('text.bubble-leaf-label')).toHaveLength(0);

		container.innerHTML = '';
		renderBubbleChart(container, rows, 'categoria', {
			labelMode: 'all',
			autoLabelMinRadius: 999,
		});
		const outsideLabels = Array.from(container.querySelectorAll('text.bubble-leaf-label'))
			.filter(label => label.getAttribute('dominant-baseline') === 'hanging');
		expect(outsideLabels.length).toBeGreaterThan(0);
	});

	it('returns no-value-column when sum mode has no value column', () => {
		const container = document.getElementById('bubble');

		const result = renderBubbleChart(container, [{ categoria: 'A' }], 'categoria', {
			measureMode: 'sum',
		});

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

		renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
			nestingColumns: ['grupo'],
			zoomTransitionDuration: 0,
		});

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

	it('shows parent filter actions and state badges for included tokens', () => {
		const container = document.getElementById('bubble');
		const calls = [];
		renderBubbleChart(container, [
			{ categoria: 'A', regiao: 'North', estado: 'PA' },
			{ categoria: 'B', regiao: 'North', estado: 'AM' },
		], 'categoria', {
			nestingMode: 'grouped',
			nestingColumns: ['regiao', 'estado'],
			filterCallbacks: {
				filterActionLabels: { remove: 'Remove', stateIncluded: 'Already included' },
				getTokenFilterState: () => 'included',
				isShowOnlyThisRedundant: () => true,
				onRemoveFromGlobalFilter: (column, token) => calls.push(['remove', column, token]),
			},
		});

		const parent = container.querySelector('g.bubble-parent[data-depth="1"]');
		parent.dispatchEvent(mouse('click'));

		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip.textContent).toContain('Already included');
		expect(tooltip.textContent).toContain('Remove');
		tooltip.querySelector('.chart-tooltip__action').click();
		expect(calls[0]).toEqual(['remove', 'regiao', 'v:North']);
	});

	it('shows leaf filter actions for excluded and unfiltered tokens and honors redundant focus', () => {
		const container = document.getElementById('bubble');
		const calls = [];
		const rows = [
			{ categoria: 'A', grupo: 'X' },
			{ categoria: 'B', grupo: 'Y' },
		];

		renderBubbleChart(container, rows, 'categoria', {
			filterCallbacks: {
				filterActionLabels: {
					focus: 'Only',
					add: 'Add',
					exclude: 'Hide',
					bringBack: 'Bring back',
					stateExcluded: 'Hidden',
				},
				getTokenFilterState: (_column, token) => (token === 'v:A' ? 'excluded' : null),
				isShowOnlyThisRedundant: (_column, token) => token === 'v:B',
				onFocusGlobalFilter: (column, token) => calls.push(['focus', column, token]),
				onAddToGlobalFilter: (column, token) => calls.push(['add', column, token]),
				onExcludeGlobalFilter: (column, token) => calls.push(['exclude', column, token]),
				onBringBackGlobalFilter: (column, token) => calls.push(['back', column, token]),
			},
		});

		const leaves = Array.from(container.querySelectorAll('g.bubble-node'));
		const leafA = leaves.find(node => node.textContent.includes('A'));
		const leafB = leaves.find(node => node.textContent.includes('B'));

		leafA.dispatchEvent(mouse('click'));
		expect(document.querySelector('.chart-tooltip').textContent).toContain('Hidden');
		Array.from(document.querySelectorAll('.chart-tooltip__action'))
			.find(button => button.textContent === 'Bring back')
			.click();
		expect(calls).toContainEqual(['back', 'categoria', 'v:A']);

		leafB.dispatchEvent(mouse('click'));
		const actionLabels = Array.from(document.querySelectorAll('.chart-tooltip__action')).map(button => button.textContent);
		expect(actionLabels).toEqual(['Add', 'Hide']);
		document.querySelectorAll('.chart-tooltip__action')[0].click();
		document.querySelectorAll('.chart-tooltip__action')[1].click();
		expect(calls).toContainEqual(['add', 'categoria', 'v:B']);
		expect(calls).toContainEqual(['exclude', 'categoria', 'v:B']);
	});

	it('renders pinned leaf tooltip without action sets when callbacks are absent', () => {
		const container = document.getElementById('bubble');
		renderBubbleChart(container, [
			{ categoria: 'A', grupo: 'X' },
			{ categoria: 'B', grupo: 'Y' },
		], 'categoria');

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
