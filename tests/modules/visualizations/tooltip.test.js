// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('tooltip', () => {
	let showChartTooltip;
	let hideChartTooltip;
	let moveChartTooltip;
	let pinTooltip;
	let unpinTooltip;
	let repositionPinnedTooltip;
	let isTooltipPinned;
	let createTooltipFilterAction;

	const originalInnerWidth = window.innerWidth;
	const originalInnerHeight = window.innerHeight;

	beforeEach(async () => {
		document.body.innerHTML = '';
		// Re-import to reset the module-level tooltipEl and pinnedAnchor
		vi.resetModules();
		const mod = await import('../../../src/modules/visualizations/tooltip.js');
		showChartTooltip = mod.showChartTooltip;
		hideChartTooltip = mod.hideChartTooltip;
		moveChartTooltip = mod.moveChartTooltip;
		pinTooltip = mod.pinTooltip;
		unpinTooltip = mod.unpinTooltip;
		repositionPinnedTooltip = mod.repositionPinnedTooltip;
		isTooltipPinned = mod.isTooltipPinned;
		createTooltipFilterAction = mod.createTooltipFilterAction;
	});

	afterEach(() => {
		Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, configurable: true });
		Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, configurable: true });
	});

	function stubTooltipRect(width, height) {
		const tooltip = document.querySelector('.chart-tooltip');
		tooltip.getBoundingClientRect = () => ({
			x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height,
			toJSON() {},
		});
		return tooltip;
	}

	it('creates tooltip element on first show and displays text content', () => {
		showChartTooltip('Hello', 100, 200);
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip).not.toBeNull();
		expect(tooltip.textContent).toBe('Hello');
		expect(tooltip.style.display).toBe('block');
	});

	it('positions tooltip with offset', () => {
		showChartTooltip('Test', 50, 60);
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip.style.left).toBe('62px');
		expect(tooltip.style.top).toBe('72px');
	});

	it('hides tooltip', () => {
		showChartTooltip('Visible', 0, 0);
		hideChartTooltip();
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip.style.display).toBe('none');
	});

	it('moves tooltip to new position', () => {
		showChartTooltip('Move me', 0, 0);
		moveChartTooltip(200, 300);
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip.style.left).toBe('212px');
		expect(tooltip.style.top).toBe('312px');
	});

	it('accepts Node content instead of string', () => {
		const span = document.createElement('span');
		span.textContent = 'Rich content';
		showChartTooltip(span, 10, 10);
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip.querySelector('span')?.textContent).toBe('Rich content');
	});

	it('handles null/undefined content gracefully', () => {
		showChartTooltip(null, 0, 0);
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip.textContent).toBe('');
	});

	it('reuses existing tooltip element', () => {
		showChartTooltip('First', 0, 0);
		showChartTooltip('Second', 0, 0);
		const tooltips = document.querySelectorAll('.chart-tooltip');
		expect(tooltips.length).toBe(1);
		expect(tooltips[0].textContent).toBe('Second');
	});

	it('flips horizontally when source point is near the right viewport edge', () => {
		Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
		Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });
		showChartTooltip('overflow-right', 0, 0);
		stubTooltipRect(200, 60);
		moveChartTooltip(700, 100);
		const tooltip = document.querySelector('.chart-tooltip');
		// expected page-space left: 700 - 200 - 12 = 488
		expect(parseFloat(tooltip.style.left)).toBeLessThanOrEqual(700 - 200);
		expect(parseFloat(tooltip.style.left)).toBe(488);
	});

	it('flips vertically when source point is near the bottom viewport edge', () => {
		Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
		Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });
		showChartTooltip('overflow-bottom', 0, 0);
		stubTooltipRect(120, 80);
		moveChartTooltip(100, 560);
		const tooltip = document.querySelector('.chart-tooltip');
		// expected page-space top: 560 - 80 - 12 = 468
		expect(parseFloat(tooltip.style.top)).toBe(468);
	});

	it('clamps to left padding when source x is off-screen left', () => {
		Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
		Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });
		showChartTooltip('clamp-left', 0, 0);
		stubTooltipRect(120, 60);
		moveChartTooltip(-50, 100);
		const tooltip = document.querySelector('.chart-tooltip');
		// VIEWPORT_PADDING = 8
		expect(tooltip.style.left).toBe('8px');
	});

	it('clamps to top padding when source y is off-screen top', () => {
		Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
		Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });
		showChartTooltip('clamp-top', 0, 0);
		stubTooltipRect(120, 60);
		moveChartTooltip(100, -50);
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip.style.top).toBe('8px');
	});

	it('adds and removes the pinned class via pinTooltip / unpinTooltip', () => {
		showChartTooltip('pin', 100, 100);
		pinTooltip(null);
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip.classList.contains('chart-tooltip--fixado')).toBe(true);
		expect(isTooltipPinned()).toBe(true);
		unpinTooltip();
		expect(tooltip.classList.contains('chart-tooltip--fixado')).toBe(false);
		expect(isTooltipPinned()).toBe(false);
	});

	it('repositionPinnedTooltip moves the tooltip to the current anchor coords', () => {
		showChartTooltip('anchored', 50, 50);
		const target = { x: 30, y: 40 };
		pinTooltip(() => target);
		const tooltip = document.querySelector('.chart-tooltip');
		// initial pin call repositions immediately
		expect(tooltip.style.left).toBe('42px');
		expect(tooltip.style.top).toBe('52px');

		target.x = 200;
		target.y = 300;
		repositionPinnedTooltip();
		expect(tooltip.style.left).toBe('212px');
		expect(tooltip.style.top).toBe('312px');
	});

	it('repositionPinnedTooltip is a no-op when no anchor is set', () => {
		showChartTooltip('no-anchor', 10, 10);
		const tooltip = document.querySelector('.chart-tooltip');
		const beforeLeft = tooltip.style.left;
		const beforeTop = tooltip.style.top;
		repositionPinnedTooltip();
		expect(tooltip.style.left).toBe(beforeLeft);
		expect(tooltip.style.top).toBe(beforeTop);
	});

	it('hideChartTooltip clears the pinned state', () => {
		showChartTooltip('pin then hide', 100, 100);
		pinTooltip(null);
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip.classList.contains('chart-tooltip--fixado')).toBe(true);
		hideChartTooltip();
		expect(tooltip.classList.contains('chart-tooltip--fixado')).toBe(false);
		expect(isTooltipPinned()).toBe(false);
	});

	it('createTooltipFilterAction returns a button that invokes the supplied onClick', () => {
		const calls = [];
		const button = createTooltipFilterAction({
			label: 'Add',
			onClick: () => calls.push('clicked'),
		});
		expect(button.tagName).toBe('BUTTON');
		expect(button.textContent).toBe('Add');
		expect(button.className).toBe('chart-tooltip__action');

		button.click();
		expect(calls).toEqual(['clicked']);
	});

	it('createTooltipFilterAction is safe when no onClick is provided', () => {
		const button = createTooltipFilterAction({ label: 'Add' });
		expect(() => button.click()).not.toThrow();
	});
});
