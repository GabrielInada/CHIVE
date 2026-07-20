// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { renderBubbleChart } from '../../../../src/charts/bubble/renderers/svg.js';

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
