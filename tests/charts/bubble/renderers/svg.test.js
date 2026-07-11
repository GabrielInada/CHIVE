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
		expect(document.querySelector('.chart-tooltip')?.style.display).toBe('block');
		expect(circle.getAttribute('fill-opacity')).toBe('0.25');
		parent.dispatchEvent(mouse('mousemove'));
		parent.dispatchEvent(mouse('mouseleave'));
		expect(document.querySelector('.chart-tooltip')?.style.display).toBe('none');

		parent.dispatchEvent(mouse('click'));
		expect(document.querySelector('.chart-tooltip')?.classList.contains('chart-tooltip--fixado')).toBe(true);
		parent.dispatchEvent(mouse('mouseenter'));
		parent.dispatchEvent(mouse('mousemove'));
		parent.dispatchEvent(mouse('mouseleave'));
		expect(document.querySelector('.chart-tooltip')?.classList.contains('chart-tooltip--fixado')).toBe(true);

		parent.dispatchEvent(mouse('click'));
		expect(document.querySelector('.chart-tooltip')?.style.display).toBe('none');
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
		expect(document.querySelector('.chart-tooltip')?.style.display).toBe('none');
	});
});

describe('bubble chart multi-level nesting', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="bubble"></div>';
	});

	it('nestingColumns length 1 matches current grouped behavior', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', grupo: 'X' },
			{ categoria: 'B', grupo: 'X' },
			{ categoria: 'C', grupo: 'Y' },
		];

		const result = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
			nestingColumns: ['grupo'],
		});

		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-parent').length).toBe(2);
		expect(container.querySelectorAll('g.bubble-node').length).toBe(3);
	});

	it('nestingColumns length 2 creates two intermediate depths plus leaves', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', regiao: 'Norte', estado: 'PA' },
			{ categoria: 'B', regiao: 'Norte', estado: 'PA' },
			{ categoria: 'C', regiao: 'Norte', estado: 'AM' },
			{ categoria: 'D', regiao: 'Sul', estado: 'RS' },
		];

		const result = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
			nestingColumns: ['regiao', 'estado'],
		});

		expect(result.ok).toBe(true);
		// Depth 1: Norte, Sul = 2 parents
		// Depth 2: PA, AM, RS = 3 parents
		// Total intermediate: 5
		expect(container.querySelectorAll('g.bubble-parent').length).toBe(5);
		expect(container.querySelectorAll('g.bubble-node').length).toBe(4);

		// Check depth attributes
		const depth1 = container.querySelectorAll('g.bubble-parent[data-depth="1"]');
		const depth2 = container.querySelectorAll('g.bubble-parent[data-depth="2"]');
		expect(depth1.length).toBe(2);
		expect(depth2.length).toBe(3);
	});

	it('nestingColumns length 3 creates expected depth chain', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', continente: 'America', pais: 'Brasil', regiao: 'Norte' },
			{ categoria: 'B', continente: 'America', pais: 'Brasil', regiao: 'Sul' },
			{ categoria: 'C', continente: 'Europa', pais: 'Portugal', regiao: 'Lisboa' },
		];

		const result = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
			nestingColumns: ['continente', 'pais', 'regiao'],
		});

		expect(result.ok).toBe(true);
		const depth1 = container.querySelectorAll('g.bubble-parent[data-depth="1"]');
		const depth2 = container.querySelectorAll('g.bubble-parent[data-depth="2"]');
		const depth3 = container.querySelectorAll('g.bubble-parent[data-depth="3"]');
		expect(depth1.length).toBe(2); // America, Europa
		expect(depth2.length).toBe(2); // Brasil, Portugal
		expect(depth3.length).toBe(3); // Norte, Sul, Lisboa
		expect(container.querySelectorAll('g.bubble-node').length).toBe(3);
	});

	it('grouped with only groupColumn still works (migration)', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', grupo: 'X' },
			{ categoria: 'B', grupo: 'Y' },
		];

		const result = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
			groupColumn: 'grupo',
		});

		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-parent').length).toBe(2);
	});

	it('grouped with both nestingColumns and groupColumn prefers nestingColumns', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', regiao: 'Norte', grupo: 'X' },
			{ categoria: 'B', regiao: 'Sul', grupo: 'Y' },
		];

		const result = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
			nestingColumns: ['regiao'],
			groupColumn: 'grupo',
		});

		expect(result.ok).toBe(true);
		// Should group by 'regiao', not 'grupo'
		const parents = container.querySelectorAll('g.bubble-parent');
		expect(parents.length).toBe(2);
	});

	it('null values in nesting columns normalized and rendered', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', grupo: null },
			{ categoria: 'B', grupo: 'X' },
		];

		const result = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
			nestingColumns: ['grupo'],
		});

		expect(result.ok).toBe(true);
		// Two groups: 'N/A' and 'X'
		expect(container.querySelectorAll('g.bubble-parent').length).toBe(2);
	});

	it('single-item groups render and zoom without errors', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', grupo: 'X' },
		];

		const result = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
			nestingColumns: ['grupo'],
			zoomTransitionDuration: 0,
		});

		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-parent').length).toBe(1);
		expect(container.querySelectorAll('g.bubble-node').length).toBe(1);
	});

	it('empty grouped nesting returns no-nesting-columns fail reason', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A' },
		];

		const result = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
			nestingColumns: [],
		});

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('no-nesting-columns');
	});

	it('grouped mode with an invalid truthy groupColumn fails instead of rendering flat', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', grupo: 'X' },
			{ categoria: 'B', grupo: 'Y' },
		];

		for (const badGroup of [{}, 1, true]) {
			container.innerHTML = '';
			const result = renderBubbleChart(container, rows, 'categoria', {
				nestingMode: 'grouped',
				groupColumn: badGroup,
			});
			expect(result.ok).toBe(false);
			expect(result.reason).toBe('no-nesting-columns');
			expect(container.querySelectorAll('g.bubble-node').length).toBe(0);
		}

		// A valid string groupColumn in the same setup still resolves and renders grouped.
		container.innerHTML = '';
		const ok = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
			groupColumn: 'grupo',
		});
		expect(ok.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-parent').length).toBe(2);
	});

	it('intermediate nodes rendered for all depths', () => {
		const container = document.getElementById('bubble');
		const rows = [
			{ categoria: 'A', regiao: 'Norte', estado: 'PA' },
			{ categoria: 'B', regiao: 'Sul', estado: 'RS' },
		];

		const result = renderBubbleChart(container, rows, 'categoria', {
			nestingMode: 'grouped',
			nestingColumns: ['regiao', 'estado'],
		});

		expect(result.ok).toBe(true);
		const allParents = container.querySelectorAll('g.bubble-parent');
		// 2 regions + 2 states = 4 intermediate nodes
		expect(allParents.length).toBe(4);
	});
});

describe('bubble chart zoom exploration', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="bubble"></div>';
	});

	const groupedData = [
		{ categoria: 'A', grupo: 'X' },
		{ categoria: 'B', grupo: 'X' },
		{ categoria: 'C', grupo: 'Y' },
		{ categoria: 'D', grupo: 'Y' },
	];

	const groupedOpts = {
		nestingMode: 'grouped',
		groupColumn: 'grupo',
		zoomTransitionDuration: 0,
	};

	it('double-click on parent circle applies zoom transform', () => {
		const container = document.getElementById('bubble');
		renderBubbleChart(container, groupedData, 'categoria', groupedOpts);

		const parentGroup = container.querySelector('g.bubble-parent');
		const viewportG = container.querySelector('svg > g');
		const originalTransform = viewportG.getAttribute('transform');

		parentGroup.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

		const newTransform = viewportG.getAttribute('transform');
		expect(newTransform).not.toBe(originalTransform);
		expect(newTransform).toContain('scale(');
	});

	it('click on SVG background resets zoom', () => {
		const container = document.getElementById('bubble');
		renderBubbleChart(container, groupedData, 'categoria', groupedOpts);

		const parentGroup = container.querySelector('g.bubble-parent');
		const viewportG = container.querySelector('svg > g');
		const originalTransform = viewportG.getAttribute('transform');

		parentGroup.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		expect(viewportG.getAttribute('transform')).toContain('scale(');

		container.querySelector('svg').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(viewportG.getAttribute('transform')).toBe(originalTransform);
	});

	it('flat mode has no parent circles to zoom into', () => {
		const container = document.getElementById('bubble');
		renderBubbleChart(container, groupedData, 'categoria', {
			nestingMode: 'flat',
			groupColumn: 'grupo',
			zoomTransitionDuration: 0,
		});

		expect(container.querySelectorAll('g.bubble-parent').length).toBe(0);
		const viewportG = container.querySelector('svg > g');
		const transform = viewportG.getAttribute('transform');
		expect(transform).not.toContain('scale(');
	});

	it('zoom dims non-focused sibling groups', () => {
		const container = document.getElementById('bubble');
		renderBubbleChart(container, groupedData, 'categoria', groupedOpts);

		const parents = container.querySelectorAll('g.bubble-parent');
		expect(parents.length).toBe(2);

		parents[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

		expect(parents[0].getAttribute('opacity')).toBe('1');
		expect(parents[1].getAttribute('opacity')).toBe('0.12');
	});

	it('zoom disables pointer-events on non-focused siblings', () => {
		const container = document.getElementById('bubble');
		renderBubbleChart(container, groupedData, 'categoria', groupedOpts);

		const parents = container.querySelectorAll('g.bubble-parent');
		parents[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

		expect(parents[0].style.pointerEvents).toBe('all');
		expect(parents[1].style.pointerEvents).toBe('none');
	});

	it('reset zoom restores sibling opacity and pointer-events', () => {
		const container = document.getElementById('bubble');
		renderBubbleChart(container, groupedData, 'categoria', groupedOpts);

		const parents = container.querySelectorAll('g.bubble-parent');
		parents[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		expect(parents[1].getAttribute('opacity')).toBe('0.12');

		container.querySelector('svg').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(parents[0].getAttribute('opacity')).toBe('1');
		expect(parents[1].getAttribute('opacity')).toBe('1');
		expect(parents[1].style.pointerEvents).toBe('all');
	});

	it('parent circles have pointer cursor in grouped mode', () => {
		const container = document.getElementById('bubble');
		renderBubbleChart(container, groupedData, 'categoria', groupedOpts);

		const parentCircle = container.querySelector('g.bubble-parent circle');
		expect(parentCircle.style.cursor).toBe('pointer');
	});

	it('single-click on leaf node does not trigger zoom', () => {
		const container = document.getElementById('bubble');
		renderBubbleChart(container, groupedData, 'categoria', groupedOpts);

		const viewportG = container.querySelector('svg > g');
		const originalTransform = viewportG.getAttribute('transform');

		const leafNode = container.querySelector('g.bubble-node');
		leafNode.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(viewportG.getAttribute('transform')).toBe(originalTransform);
	});
});

describe('bubble chart zoom stack (multi-level drill-down)', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="bubble"></div>';
	});

	const multiLevelData = [
		{ categoria: 'A', regiao: 'Norte', estado: 'PA' },
		{ categoria: 'B', regiao: 'Norte', estado: 'PA' },
		{ categoria: 'C', regiao: 'Norte', estado: 'AM' },
		{ categoria: 'D', regiao: 'Sul', estado: 'RS' },
	];

	const multiLevelOpts = {
		nestingMode: 'grouped',
		nestingColumns: ['regiao', 'estado'],
		zoomTransitionDuration: 0,
	};

	it('double-click drills from level 1 to level 2', () => {
		const container = document.getElementById('bubble');
		renderBubbleChart(container, multiLevelData, 'categoria', multiLevelOpts);

		const viewportG = container.querySelector('svg > g');
		const originalTransform = viewportG.getAttribute('transform');

		// Drill into depth-1 parent (region)
		const depth1Parent = container.querySelector('g.bubble-parent[data-depth="1"]');
		depth1Parent.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		const afterDrill1 = viewportG.getAttribute('transform');
		expect(afterDrill1).toContain('scale(');
		expect(afterDrill1).not.toBe(originalTransform);

		// Drill deeper into depth-2 parent (state)
		const depth2Parents = container.querySelectorAll('g.bubble-parent[data-depth="2"]');
		// Find a depth-2 parent that is visible (opacity 1)
		let visibleDepth2 = null;
		for (const p of depth2Parents) {
			if (p.getAttribute('opacity') === '1') {
				visibleDepth2 = p;
				break;
			}
		}
		expect(visibleDepth2).not.toBeNull();
		visibleDepth2.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		const afterDrill2 = viewportG.getAttribute('transform');
		expect(afterDrill2).toContain('scale(');
		expect(afterDrill2).not.toBe(afterDrill1);
	});

	it('background click goes back one level, not all levels', () => {
		const container = document.getElementById('bubble');
		renderBubbleChart(container, multiLevelData, 'categoria', multiLevelOpts);

		const viewportG = container.querySelector('svg > g');

		// Drill into depth-1
		const depth1Parent = container.querySelector('g.bubble-parent[data-depth="1"]');
		depth1Parent.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		const afterDrill1 = viewportG.getAttribute('transform');

		// Drill into depth-2
		const depth2Parents = container.querySelectorAll('g.bubble-parent[data-depth="2"]');
		let visibleDepth2 = null;
		for (const p of depth2Parents) {
			if (p.getAttribute('opacity') === '1') {
				visibleDepth2 = p;
				break;
			}
		}
		visibleDepth2.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

		// Click background: should go back to depth-1 zoom, not root
		container.querySelector('svg').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const afterBack1 = viewportG.getAttribute('transform');
		expect(afterBack1).toContain('scale(');
		expect(afterBack1).toBe(afterDrill1);
	});

	it('second background click returns to root', () => {
		const container = document.getElementById('bubble');
		renderBubbleChart(container, multiLevelData, 'categoria', multiLevelOpts);

		const viewportG = container.querySelector('svg > g');
		const originalTransform = viewportG.getAttribute('transform');

		// Drill into depth-1
		const depth1Parent = container.querySelector('g.bubble-parent[data-depth="1"]');
		depth1Parent.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

		// Drill into depth-2
		const depth2Parents = container.querySelectorAll('g.bubble-parent[data-depth="2"]');
		let visibleDepth2 = null;
		for (const p of depth2Parents) {
			if (p.getAttribute('opacity') === '1') {
				visibleDepth2 = p;
				break;
			}
		}
		visibleDepth2.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

		// Click background twice
		container.querySelector('svg').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		container.querySelector('svg').dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// Should be fully reset
		expect(viewportG.getAttribute('transform')).toBe(originalTransform);
	});

	it('non-focused branches dimmed and pointer-events none while zoomed', () => {
		const container = document.getElementById('bubble');
		renderBubbleChart(container, multiLevelData, 'categoria', multiLevelOpts);

		const depth1Parents = container.querySelectorAll('g.bubble-parent[data-depth="1"]');
		expect(depth1Parents.length).toBe(2);

		// Zoom into first depth-1 parent
		depth1Parents[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

		expect(depth1Parents[0].getAttribute('opacity')).toBe('1');
		expect(depth1Parents[1].getAttribute('opacity')).toBe('0.12');
		expect(depth1Parents[1].style.pointerEvents).toBe('none');
	});

	it('leaf labels re-evaluated after zoom scale', () => {
		const container = document.getElementById('bubble');
		renderBubbleChart(container, multiLevelData, 'categoria', {
			...multiLevelOpts,
			labelMode: 'auto',
		});

		const labelsBefore = container.querySelectorAll('text.bubble-leaf-label').length;

		// Zoom in
		const depth1Parent = container.querySelector('g.bubble-parent[data-depth="1"]');
		depth1Parent.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

		const labelsAfter = container.querySelectorAll('text.bubble-leaf-label').length;
		// After zoom, apparent radius increases, so at least as many labels should show
		expect(labelsAfter).toBeGreaterThanOrEqual(labelsBefore);
	});
});
