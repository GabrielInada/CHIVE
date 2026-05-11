// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
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
		const dados = [
			{ origem: 'A', destino: 'B', peso: 2 },
			{ origem: 'B', destino: 'C', peso: 1 },
			{ origem: 'A', destino: 'C', peso: 3 },
		];

		const result = renderNetworkGraph(container, dados, 'origem', 'destino', {
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
		const dados = [
			{ origem: 'A', destino: 'B' },
			{ origem: 'B', destino: 'C' },
		];

		renderNetworkGraph(container, dados, 'origem', 'destino', {
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
		const dados = [
			{ origem: 'A', destino: 'B' },
			{ origem: 'B', destino: 'C' },
		];

		renderNetworkGraph(container, dados, 'origem', 'destino', { showLegend: true });

		const legendTexts = Array.from(container.querySelectorAll('.network-legend text'))
			.map(node => node.textContent);
		expect(legendTexts).toContain('Source');
		expect(legendTexts).toContain('Target');
	});

	it('returns explicit failure when there is no valid source-target data', () => {
		const container = document.getElementById('network');
		const dados = [
			{ origem: '', destino: '' },
			{ origem: null, destino: undefined },
		];

		const result = renderNetworkGraph(container, dados, 'origem', 'destino');

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('insufficient-data');
	});

	it('pins the tooltip when a node is clicked', () => {
		const container = document.getElementById('network');
		const dados = [
			{ origem: 'A', destino: 'B' },
			{ origem: 'B', destino: 'C' },
		];
		renderNetworkGraph(container, dados, 'origem', 'destino');
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
		const dados = [
			{ origem: 'A', destino: 'B' },
			{ origem: 'B', destino: 'C' },
		];
		renderNetworkGraph(container, dados, 'origem', 'destino');
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
		const dados = [
			{ origem: 'A', destino: 'B' },
			{ origem: 'B', destino: 'C' },
		];
		renderNetworkGraph(container, dados, 'origem', 'destino');
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
});
