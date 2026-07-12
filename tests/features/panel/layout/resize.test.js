// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getPanelBlocks: vi.fn(),
	t: vi.fn(key => key),
}));

vi.mock('../../../../src/modules/state/appState.js', () => ({
	getPanelBlocks: mocks.getPanelBlocks,
}));

vi.mock('../../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

import {
	applyBlockProportions,
	renderGuidedResizeHandles,
	startBlockHeightResizeDrag,
} from '../../../../src/features/panel/layout/resize.js';

function makeGrid({ width = 200, height = 100 } = {}) {
	const grid = document.createElement('div');
	Object.defineProperty(grid, 'getBoundingClientRect', {
		value: () => ({ left: 0, top: 0, width, height }),
		configurable: true,
	});
	document.body.appendChild(grid);
	return grid;
}

function drag(handle, move) {
	handle.dispatchEvent(new MouseEvent('mousedown', {
		bubbles: true,
		cancelable: true,
		clientX: 0,
		clientY: 0,
	}));
	window.dispatchEvent(new MouseEvent('mousemove', {
		clientX: move.x ?? 0,
		clientY: move.y ?? 0,
	}));
	window.dispatchEvent(new MouseEvent('mouseup'));
}

describe('panel layout resize', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		vi.clearAllMocks();
	});

	it('applies proportions and dynamic min-height clamps', () => {
		const grid = makeGrid();

		applyBlockProportions(grid, {
			templateId: 'template-2col',
			proportions: { split: 42 },
			heightPx: 900,
		});
		expect(grid.style.getPropertyValue('--split')).toBe('42%');
		expect(grid.style.minHeight).toBe('760px');

		applyBlockProportions(grid, {
			templateId: 'template-1x2',
			proportions: { split: 80 },
			heightPx: Number.NaN,
		});
		expect(parseInt(grid.style.minHeight, 10)).toBeGreaterThan(220);

		expect(() => applyBlockProportions(grid, null)).not.toThrow();
	});

	it('renders no handles without a grid or proportions', () => {
		expect(() => renderGuidedResizeHandles(null, { proportions: {} }, vi.fn())).not.toThrow();
		const grid = makeGrid();
		renderGuidedResizeHandles(grid, { id: 'block-1' }, vi.fn());
		expect(grid.querySelectorAll('.panel-resize-handle').length).toBe(0);
	});

	it.each([
		[
			'template-2col',
			{ split: 50 },
			{ selector: '[data-panel-resize-handle="block-1:split"]', move: { x: 180 }, expected: { split: 80 } },
		],
		[
			'template-1x2',
			{ split: 50 },
			{ selector: '[data-panel-resize-handle="block-1:split"]', move: { y: 10 }, expected: { split: 20 } },
		],
		[
			'template-hero2',
			{ splitMain: 60, splitRight: 50 },
			{ selector: '[data-panel-resize-handle="block-1:splitMain"]', move: { x: 150 }, expected: { splitMain: 75 } },
		],
		[
			'template-hero2',
			{ splitMain: 60, splitRight: 50 },
			{ selector: '[data-panel-resize-handle="block-1:splitRight"]', move: { y: 90 }, expected: { splitRight: 80 } },
		],
		[
			'template-3col',
			{ a: 33, b: 33, c: 34 },
			{ selector: '[data-panel-resize-handle="block-1:a"]', move: { x: 120 }, expected: { a: 60, b: 20, c: 20 } },
		],
		[
			'template-3col',
			{ a: 33, b: 33, c: 34 },
			{ selector: '[data-panel-resize-handle="block-1:ab"]', move: { x: 170 }, expected: { a: 33, b: 47, c: 20 } },
		],
	])('updates guided resize proportions for %s', (templateId, proportions, scenario) => {
		const grid = makeGrid();
		const block = { id: 'block-1', templateId, proportions };
		const onUpdate = vi.fn();
		mocks.getPanelBlocks.mockReturnValue([block]);

		renderGuidedResizeHandles(grid, block, onUpdate);
		const handle = grid.querySelector(scenario.selector);
		expect(handle).not.toBeNull();
		expect(handle.getAttribute('aria-label')).toBe('chive-panel-resize-handle');

		drag(handle, scenario.move);

		expect(onUpdate).toHaveBeenLastCalledWith('block-1', scenario.expected);
		expect(grid.classList.contains('is-resizing')).toBe(false);
	});

	it('ignores guided drag when geometry is unavailable or block is removed mid-drag', () => {
		const noRectGrid = makeGrid({ width: 0, height: 100 });
		const noRectBlock = { id: 'missing-rect', templateId: 'template-2col', proportions: { split: 50 } };
		const noRectUpdate = vi.fn();
		mocks.getPanelBlocks.mockReturnValue([noRectBlock]);
		renderGuidedResizeHandles(noRectGrid, noRectBlock, noRectUpdate);
		drag(noRectGrid.querySelector('.panel-resize-handle'), { x: 180 });
		expect(noRectUpdate).not.toHaveBeenCalled();

		const grid = makeGrid();
		const block = { id: 'block-1', templateId: 'template-2col', proportions: { split: 50 } };
		const onUpdate = vi.fn();
		mocks.getPanelBlocks.mockReturnValue([]);
		renderGuidedResizeHandles(grid, block, onUpdate);
		drag(grid.querySelector('.panel-resize-handle'), { x: 180 });
		expect(onUpdate).not.toHaveBeenCalled();
	});

	it('resizes block height and cleans up listeners on release', () => {
		const grid = makeGrid({ height: 240 });
		const onUpdate = vi.fn();

		startBlockHeightResizeDrag('block-1', grid, 100, onUpdate);
		expect(grid.classList.contains('is-resizing')).toBe(true);
		window.dispatchEvent(new MouseEvent('mousemove', { clientY: 145 }));
		expect(onUpdate).toHaveBeenCalledWith('block-1', 285);
		window.dispatchEvent(new MouseEvent('mouseup'));
		expect(grid.classList.contains('is-resizing')).toBe(false);

		window.dispatchEvent(new MouseEvent('mousemove', { clientY: 200 }));
		expect(onUpdate).toHaveBeenCalledTimes(1);
	});

	it('does not start height resize for invalid geometry or start position', () => {
		const zeroHeight = makeGrid({ height: 0 });
		const onUpdate = vi.fn();
		startBlockHeightResizeDrag('block-1', zeroHeight, 100, onUpdate);
		window.dispatchEvent(new MouseEvent('mousemove', { clientY: 150 }));
		expect(onUpdate).not.toHaveBeenCalled();

		const grid = makeGrid({ height: 120 });
		startBlockHeightResizeDrag('block-1', grid, Number.NaN, onUpdate);
		window.dispatchEvent(new MouseEvent('mousemove', { clientY: 150 }));
		expect(onUpdate).not.toHaveBeenCalled();
	});
});
