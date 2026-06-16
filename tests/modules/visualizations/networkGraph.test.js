// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderNetworkGraph } from '../../../src/modules/visualizations/networkGraph.js';
import { hideChartTooltip } from '../../../src/modules/visualizations/tooltip.js';

function stubScreenCTM(container) {
	const identity = {
		a: 1, b: 0, c: 0, d: 1, e: 0, f: 0,
	};
	container.querySelectorAll('svg, g').forEach(node => {
		node.getScreenCTM = () => identity;
	});
	const svg = container.querySelector('svg');
	if (svg && typeof svg.createSVGPoint !== 'function') {
		svg.createSVGPoint = () => ({
			x: 0,
			y: 0,
			matrixTransform(matrix) {
				return {
					x: matrix.a * this.x + matrix.c * this.y + matrix.e,
					y: matrix.b * this.x + matrix.d * this.y + matrix.f,
				};
			},
		});
	}
}

function fireMouseEvent(target, type) {
	const event = new MouseEvent(type, { bubbles: true, cancelable: true });
	target.dispatchEvent(event);
}

describe('network graph visualization', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="network"></div>';
		hideChartTooltip();
	});

	it('renders links and nodes from source/target columns', () => {
		const container = document.getElementById('network');
		const rows = [
			{ origem: 'A', destino: 'B', peso: 2 },
			{ origem: 'B', destino: 'C', peso: 1 },
			{ origem: 'A', destino: 'C', peso: 3 },
		];

		const result = renderNetworkGraph(container, rows, 'origem', 'destino', {
			weightColumn: 'peso',
			showNodeLabels: true,
		});

		expect(result.ok).toBe(true);
		expect(result.nodesCount).toBe(3);
		expect(result.linksCount).toBe(3);
		expect(container.querySelectorAll('line').length).toBe(3);
		expect(container.querySelectorAll('circle').length).toBe(3);
	});

	it('uses configured source/target labels in the legend', () => {
		const container = document.getElementById('network');
		const rows = [
			{ origem: 'A', destino: 'B' },
			{ origem: 'B', destino: 'C' },
		];

		renderNetworkGraph(container, rows, 'origem', 'destino', {
			showLegend: true,
			labels: { source: 'Origem', target: 'Destino' },
		});

		const legendTexts = Array.from(container.querySelectorAll('.network-legend text'))
			.map(node => node.textContent);
		expect(legendTexts).toContain('Origem');
		expect(legendTexts).toContain('Destino');
		expect(legendTexts).not.toContain('Source');
		expect(legendTexts).not.toContain('Target');
	});

	it('falls back to "Source" / "Target" when labels are absent', () => {
		const container = document.getElementById('network');
		const rows = [
			{ origem: 'A', destino: 'B' },
			{ origem: 'B', destino: 'C' },
		];

		renderNetworkGraph(container, rows, 'origem', 'destino', { showLegend: true });

		const legendTexts = Array.from(container.querySelectorAll('.network-legend text'))
			.map(node => node.textContent);
		expect(legendTexts).toContain('Source');
		expect(legendTexts).toContain('Target');
	});

	it('returns explicit failure when there is no valid source-target data', () => {
		const container = document.getElementById('network');
		const rows = [
			{ origem: '', destino: '' },
			{ origem: null, destino: undefined },
		];

		const result = renderNetworkGraph(container, rows, 'origem', 'destino');

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('insufficient-data');
	});

	it('pins the tooltip when a node is clicked', () => {
		const container = document.getElementById('network');
		const rows = [
			{ origem: 'A', destino: 'B' },
			{ origem: 'B', destino: 'C' },
		];
		renderNetworkGraph(container, rows, 'origem', 'destino');
		stubScreenCTM(container);

		const firstNode = container.querySelector('circle');
		fireMouseEvent(firstNode, 'click');

		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip).not.toBeNull();
		expect(tooltip.classList.contains('chart-tooltip--fixado')).toBe(true);
		expect(tooltip.style.display).toBe('block');
	});

	it('unpins and hides the tooltip on background click', () => {
		const container = document.getElementById('network');
		const rows = [
			{ origem: 'A', destino: 'B' },
			{ origem: 'B', destino: 'C' },
		];
		renderNetworkGraph(container, rows, 'origem', 'destino');
		stubScreenCTM(container);

		const firstNode = container.querySelector('circle');
		fireMouseEvent(firstNode, 'click');

		const svg = container.querySelector('svg');
		fireMouseEvent(svg, 'click');

		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip.classList.contains('chart-tooltip--fixado')).toBe(false);
		expect(tooltip.style.display).toBe('none');
	});

	it('repositions the pinned tooltip when the anchored node moves', async () => {
		const container = document.getElementById('network');
		const rows = [
			{ origem: 'A', destino: 'B' },
			{ origem: 'B', destino: 'C' },
		];
		renderNetworkGraph(container, rows, 'origem', 'destino');
		stubScreenCTM(container);

		const firstNode = container.querySelector('circle');
		fireMouseEvent(firstNode, 'click');

		const tooltip = document.querySelector('.chart-tooltip');
		const initialLeft = tooltip.style.left;

		// Mutate the underlying datum and call repositionPinnedTooltip via tooltip module
		const datum = window.d3?.select?.(firstNode)?.datum?.() ?? null;
		// d3 isn't on window in this test; use d3-selection's internal __data__ instead
		const directDatum = firstNode.__data__;
		expect(directDatum).toBeTruthy();
		directDatum.x = (Number(directDatum.x) || 0) + 250;
		directDatum.y = (Number(directDatum.y) || 0) + 250;

		const { repositionPinnedTooltip } = await import('../../../src/modules/visualizations/tooltip.js');
		repositionPinnedTooltip();

		expect(tooltip.style.left).not.toBe(initialLeft);
	});

	it('covers invalid args, option fallbacks, custom title, uniform edges, and previous simulation cleanup', () => {
		const container = document.getElementById('network');
		expect(renderNetworkGraph(null, [], 'source', 'target').ok).toBe(false);
		expect(renderNetworkGraph(container, [], '', 'target').ok).toBe(false);
		expect(renderNetworkGraph(container, [], 'source', '').ok).toBe(false);

		const previousSimulation = { stop: vi.fn() };
		container.__chive_network_simulation__ = previousSimulation;
		const rows = [
			{ source: 'A', target: 'B', weight: -1, group: 'Group 1' },
			{ source: 'B', target: 'C', weight: 'bad', group: '' },
			{ source: 'C', target: 'A', weight: 4, group: 'Group 2' },
		];

		const result = renderNetworkGraph(container, rows, 'source', 'target', {
			weightColumn: 'weight',
			groupColumn: 'group',
			nodeRadius: 'bad',
			linkOpacity: 'bad',
			chargeStrength: 'bad',
			linkDistance: 'bad',
			zoomScale: 'bad',
			alphaDecay: 99,
			sourceNodeColor: 'bad',
			targetNodeColor: 'bad',
			edgeColorMode: 'uniform',
			customTitle: 'Network Title',
			chartHeight: 999,
			showLegend: false,
			showNodeLabels: false,
		});

		expect(result.ok).toBe(true);
		expect(previousSimulation.stop).toHaveBeenCalledTimes(1);
		expect(container.textContent).toContain('Network Title');
		expect(container.querySelector('.network-legend')).toBeNull();
		expect(container.querySelector('.network-labels')).toBeNull();
		expect(container.querySelector('line').getAttribute('stroke')).toBe('#7d7d7d');
	});

	it('renders same-column node filter actions with a state badge', () => {
		const container = document.getElementById('network');
		const calls = { remove: [] };
		const rows = [
			{ node: 'A' },
			{ node: 'B' },
			{ node: 'A' },
		];

		const result = renderNetworkGraph(container, rows, 'node', 'node', {
			filterCallbacks: {
				onRemoveFromGlobalFilter: (column, token) => calls.remove.push([column, token]),
				getTokenFilterState: () => 'included',
				filterActionLabels: {
					stateIncluded: 'Included',
					remove: 'Remove',
					filterBySource: 'Source filter',
					filterByTarget: 'Target filter',
				},
			},
		});
		expect(result.ok).toBe(true);
		stubScreenCTM(container);

		container.querySelector('circle').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

		expect(document.querySelector('.chart-tooltip__filter-state--included')).not.toBeNull();
		expect(document.querySelector('.chart-tooltip__action-set-label').textContent).toBe('node');
		document.querySelector('.chart-tooltip__action').click();
		expect(calls.remove).toEqual([['node', 'v:A']]);
	});

	it('renders separate source/target action sets and suppresses redundant focus actions', () => {
		const container = document.getElementById('network');
		const rows = [
			{ source: 'A', target: 'B' },
			{ source: 'B', target: 'C' },
		];

		const result = renderNetworkGraph(container, rows, 'source', 'target', {
			filterCallbacks: {
				onFocusGlobalFilter: () => {},
				onAddToGlobalFilter: () => {},
				onExcludeGlobalFilter: () => {},
				isShowOnlyThisRedundant: () => true,
				filterActionLabels: {
					add: 'Add',
					exclude: 'Hide',
					filterBySource: 'Filter source',
					filterByTarget: 'Filter target',
				},
			},
		});
		expect(result.ok).toBe(true);
		stubScreenCTM(container);

		container.querySelector('circle').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

		expect(document.querySelectorAll('.chart-tooltip__action-set-wrap').length).toBe(2);
		expect(Array.from(document.querySelectorAll('.chart-tooltip__action')).map(button => button.textContent))
			.toEqual(['Add', 'Hide', 'Add', 'Hide']);
	});

	it('covers link and node hover branches while a tooltip is pinned', () => {
		const container = document.getElementById('network');
		renderNetworkGraph(container, [
			{ source: 'A', target: 'B', weight: 2 },
			{ source: 'B', target: 'C', weight: 3 },
		], 'source', 'target', { weightColumn: 'weight' });
		stubScreenCTM(container);

		const link = container.querySelector('line');
		link.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, pageX: 1, pageY: 2 }));
		expect(document.querySelector('.chart-tooltip').style.display).toBe('block');
		link.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, pageX: 3, pageY: 4 }));
		link.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

		const node = container.querySelector('circle');
		node.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, pageX: 1, pageY: 2 }));
		node.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, pageX: 3, pageY: 4 }));
		node.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
		node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		node.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, pageX: 5, pageY: 6 }));
		node.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, pageX: 7, pageY: 8 }));
		node.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
		node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		expect(document.querySelector('.chart-tooltip').style.display).toBe('none');
	});
});
