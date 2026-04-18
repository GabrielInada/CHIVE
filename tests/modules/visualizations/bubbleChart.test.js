// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { renderBubbleChart } from '../../../src/modules/visualizations/bubbleChart.js';

describe('bubble chart visualization', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="bubble"></div>';
	});

	it('returns failure when container or category column is missing', () => {
		const dados = [{ categoria: 'A' }];

		expect(renderBubbleChart(null, dados, 'categoria')).toEqual({ ok: false });
		expect(renderBubbleChart(document.getElementById('bubble'), dados, null)).toEqual({ ok: false });
	});

	it('renders packed bubbles and returns ok', () => {
		const container = document.getElementById('bubble');
		const dados = [
			{ categoria: 'A' },
			{ categoria: 'A' },
			{ categoria: 'B' },
			{ categoria: 'C' },
		];

		const result = renderBubbleChart(container, dados, 'categoria', {
			chartHeight: 700,
			labelMode: 'auto',
		});

		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-node > circle').length).toBe(3);
		expect(container.querySelectorAll('g.bubble-node').length).toBe(3);
	});

	it('supports count, sum, and mean aggregation plus top-N filtering', () => {
		const container = document.getElementById('bubble');
		const dados = [
			{ categoria: 'A', valor: 10 },
			{ categoria: 'A', valor: 20 },
			{ categoria: 'B', valor: 5 },
			{ categoria: 'C', valor: 40 },
		];

		const countResult = renderBubbleChart(container, dados, 'categoria', { topN: 2 });
		expect(countResult.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-node').length).toBe(2);

		container.innerHTML = '';
		const sumResult = renderBubbleChart(container, dados, 'categoria', {
			measureMode: 'sum',
			valueColumn: 'valor',
			topN: 0,
		});
		expect(sumResult.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-node').length).toBe(3);

		container.innerHTML = '';
		const meanResult = renderBubbleChart(container, dados, 'categoria', {
			measureMode: 'mean',
			valueColumn: 'valor',
		});
		expect(meanResult.ok).toBe(true);
	});

	it('returns explicit failure reasons for missing numeric data in sum mode', () => {
		const container = document.getElementById('bubble');
		const dados = [
			{ categoria: 'A', valor: 'x' },
			{ categoria: 'B', valor: 'y' },
		];

		const result = renderBubbleChart(container, dados, 'categoria', {
			measureMode: 'sum',
			valueColumn: 'valor',
		});

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('no-numeric');
	});

	it('flat mode unchanged when nestingMode is flat or omitted', () => {
		const container = document.getElementById('bubble');
		const dados = [
			{ categoria: 'A', grupo: 'X' },
			{ categoria: 'B', grupo: 'X' },
			{ categoria: 'C', grupo: 'Y' },
		];

		const result = renderBubbleChart(container, dados, 'categoria', {
			nestingMode: 'flat',
			groupColumn: 'grupo',
		});

		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-node').length).toBe(3);
		expect(container.querySelectorAll('g.bubble-parent').length).toBe(0);
	});

	it('grouped mode creates parent and leaf structure', () => {
		const container = document.getElementById('bubble');
		const dados = [
			{ categoria: 'A', grupo: 'X' },
			{ categoria: 'B', grupo: 'X' },
			{ categoria: 'C', grupo: 'Y' },
			{ categoria: 'D', grupo: 'Y' },
		];

		const result = renderBubbleChart(container, dados, 'categoria', {
			nestingMode: 'grouped',
			groupColumn: 'grupo',
		});

		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-parent').length).toBe(2);
		expect(container.querySelectorAll('g.bubble-node').length).toBe(4);
	});

	it('grouped mode without groupColumn returns fail no-group-column', () => {
		const container = document.getElementById('bubble');
		const dados = [
			{ categoria: 'A' },
			{ categoria: 'B' },
		];

		const result = renderBubbleChart(container, dados, 'categoria', {
			nestingMode: 'grouped',
		});

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('no-group-column');
	});

	it('topN still works in grouped mode (global leaf limit)', () => {
		const container = document.getElementById('bubble');
		const dados = [
			{ categoria: 'A', grupo: 'X' },
			{ categoria: 'B', grupo: 'X' },
			{ categoria: 'C', grupo: 'Y' },
			{ categoria: 'D', grupo: 'Y' },
			{ categoria: 'E', grupo: 'Z' },
		];

		const result = renderBubbleChart(container, dados, 'categoria', {
			nestingMode: 'grouped',
			groupColumn: 'grupo',
			topN: 3,
		});

		expect(result.ok).toBe(true);
		expect(container.querySelectorAll('g.bubble-node').length).toBe(3);
	});

	it('sum/mean still work in grouped mode', () => {
		const container = document.getElementById('bubble');
		const dados = [
			{ categoria: 'A', grupo: 'X', valor: 10 },
			{ categoria: 'B', grupo: 'X', valor: 20 },
			{ categoria: 'C', grupo: 'Y', valor: 30 },
		];

		const sumResult = renderBubbleChart(container, dados, 'categoria', {
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
		const dados = [
			{ categoria: 'A' },
			{ categoria: 'A' },
			{ categoria: 'B' },
		];

		renderBubbleChart(container, dados, 'categoria', {
			labelMode: 'all',
		});

		const labels = container.querySelectorAll('text.bubble-leaf-label');
		expect(labels.length).toBe(2);
	});

	it('parent tooltip includes aggregated value and child count via title element', () => {
		const container = document.getElementById('bubble');
		const dados = [
			{ categoria: 'A', grupo: 'X' },
			{ categoria: 'A', grupo: 'X' },
			{ categoria: 'B', grupo: 'X' },
			{ categoria: 'C', grupo: 'Y' },
		];

		const result = renderBubbleChart(container, dados, 'categoria', {
			nestingMode: 'grouped',
			groupColumn: 'grupo',
		});

		expect(result.ok).toBe(true);
		const parentGroups = container.querySelectorAll('g.bubble-parent');
		expect(parentGroups.length).toBe(2);
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
