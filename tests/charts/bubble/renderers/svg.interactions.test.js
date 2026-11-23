// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderContext } from '../../renderContext.js';
import { renderBubbleChart } from '../../../../src/charts/bubble/renderers/svg.js';
import { BUBBLE_CHART } from '../../../../src/config/charts/definitions/bubble.js';
import { hideChartTooltip } from '../../../../src/charts/shared/tooltip/tooltip.js';

const BASE_OPTIONS = { measureMode: 'count', labelMode: 'auto', nestingMode: 'flat', colorScheme: 'Tableau10' };

function render(rows, options) {
	const container = document.getElementById('bubble');
	const config = { category: 'categoria', ...BASE_OPTIONS, zoomTransitionDuration: 0, ...options };
	const result = renderBubbleChart(container, rows, config, renderContext({ category: 'categoria' }, config));
	expect(result.ok).toBe(true);
	return container;
}

const mouse = type => new MouseEvent(type, { bubbles: true, cancelable: true });
const radius = group => Number(group.querySelector('circle').getAttribute('r'));
const tooltip = () => document.querySelector('.chart-tooltip');
const viewportTransform = container => container.querySelector('svg > g').getAttribute('transform');
const parentByLabel = (container, label) => [...container.querySelectorAll('g.bubble-parent')]
	.find(group => group.__data__.data.groupLabel === label);

beforeEach(() => {
	document.body.innerHTML = '<div id="bubble"></div>';
});

afterEach(() => {
	hideChartTooltip();
});

describe('bubble chart labels by apparent size', () => {
	it('labels only the parent bubbles large enough to hold a heading', () => {
		const rows = [
			...Array.from({ length: 30 }, (_, index) => ({ categoria: `big-${index}`, grupo: 'Big' })),
			...Array.from({ length: 12 }, (_, index) => ({ categoria: `solo-${index}`, grupo: `Solo ${index}` })),
		];
		const container = render(rows, { nestingMode: 'grouped', nestingColumns: ['grupo'], topN: 0 });

		const parents = [...container.querySelectorAll('g.bubble-parent')];
		const labelled = parents.filter(group => group.querySelector('text.bubble-parent-label'));
		expect(labelled.length).toBeGreaterThan(0);
		expect(labelled.length).toBeLessThan(parents.length);
		for (const group of parents) {
			expect(Boolean(group.querySelector('text.bubble-parent-label')))
				.toBe(radius(group) >= BUBBLE_CHART.parentLabelMinRadius);
		}
	});

	it('in auto mode, labels only the leaves that reach the minimum radius', () => {
		const rows = [
			...Array.from({ length: 400 }, () => ({ categoria: 'Dominant' })),
			...Array.from({ length: 150 }, (_, index) => ({ categoria: `minor-${index}` })),
		];
		const container = render(rows, { labelMode: 'auto', topN: 0 });

		const leaves = [...container.querySelectorAll('g.bubble-node')];
		const labelled = leaves.filter(group => group.querySelector('text.bubble-leaf-label'));
		expect(labelled.length).toBeGreaterThan(0);
		expect(labelled.length).toBeLessThan(leaves.length);
		for (const group of leaves) {
			expect(Boolean(group.querySelector('text.bubble-leaf-label')))
				.toBe(radius(group) >= BUBBLE_CHART.autoLabelMinRadius);
		}
	});
});

describe('bubble chart tooltips and zoom', () => {
	const groupedRows = [
		{ categoria: 'A', grupo: 'X' },
		{ categoria: 'B', grupo: 'X' },
		{ categoria: 'C', grupo: 'Y' },
		{ categoria: 'D', grupo: 'Y' },
	];

	it('unpins a leaf tooltip on a background click when nothing is zoomed', () => {
		const container = render(groupedRows, { nestingMode: 'grouped', nestingColumns: ['grupo'] });

		container.querySelector('g.bubble-node').dispatchEvent(mouse('click'));
		expect(tooltip().classList.contains('chart-tooltip--fixado')).toBe(true);

		container.querySelector('svg').dispatchEvent(mouse('click'));
		expect(tooltip().classList.contains('chart-tooltip--fixado')).toBe(false);
		expect(tooltip().hidden).toBe(true);
	});

	it('shows a parent tooltip while zoomed without restyling the parent circle', () => {
		const container = render(groupedRows, { nestingMode: 'grouped', nestingColumns: ['grupo'] });
		const parent = parentByLabel(container, 'X');
		const circle = parent.querySelector('circle');
		const restingOpacity = circle.getAttribute('fill-opacity');

		parent.dispatchEvent(mouse('dblclick'));
		parent.dispatchEvent(mouse('mouseenter'));
		expect(tooltip().hidden).toBe(false);
		expect(circle.getAttribute('fill-opacity')).toBe(restingOpacity);

		parent.dispatchEvent(mouse('mouseleave'));
		expect(tooltip().hidden).toBe(true);
		expect(circle.getAttribute('fill-opacity')).toBe(restingOpacity);
	});

	it('rebuilds the zoom path when a branch outside the focus is drilled into', () => {
		const rows = [
			{ categoria: 'A', regiao: 'Norte', estado: 'PA' },
			{ categoria: 'B', regiao: 'Norte', estado: 'AM' },
			{ categoria: 'C', regiao: 'Sul', estado: 'RS' },
			{ categoria: 'D', regiao: 'Sul', estado: 'SC' },
		];
		const container = render(rows, { nestingMode: 'grouped', nestingColumns: ['regiao', 'estado'] });
		const opacity = label => parentByLabel(container, label).getAttribute('opacity');
		const rootTransform = viewportTransform(container);

		parentByLabel(container, 'Norte').dispatchEvent(mouse('dblclick'));
		expect(opacity('Sul')).toBe('0.12');

		// A drill outside the current focus replaces the stack with that branch's path.
		parentByLabel(container, 'RS').dispatchEvent(mouse('dblclick'));
		expect(opacity('RS')).toBe('1');
		expect(opacity('Norte')).toBe('0.12');

		// Going back one level lands on Sul, not on Norte where the drill began.
		container.querySelector('svg').dispatchEvent(mouse('click'));
		expect(opacity('Sul')).toBe('1');
		expect(opacity('SC')).toBe('1');
		expect(opacity('Norte')).toBe('0.12');

		container.querySelector('svg').dispatchEvent(mouse('click'));
		expect(viewportTransform(container)).toBe(rootTransform);
		expect(opacity('Norte')).toBe('1');
	});
});
