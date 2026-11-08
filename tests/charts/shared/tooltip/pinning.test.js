// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	hideChartTooltip,
	hideHoverTooltip,
	isTooltipPinned,
	moveChartTooltip,
	repositionPinnedTooltip,
	showChartTooltip,
	togglePinnedChartTooltip,
	unpinTooltip,
} from '../../../../src/charts/shared/tooltip/tooltip.js';

describe('shared chart pin ownership', () => {
	let first;
	let second;
	let frames;

	beforeEach(() => {
		document.body.innerHTML = '<svg><g id="first"><circle /></g><g id="second"><circle /></g></svg>';
		first = document.getElementById('first');
		second = document.getElementById('second');
		frames = new Map();
		let nextFrame = 0;
		vi.stubGlobal('requestAnimationFrame', callback => {
			frames.set(++nextFrame, callback);
			return nextFrame;
		});
		vi.stubGlobal('cancelAnimationFrame', id => frames.delete(id));
	});

	afterEach(() => {
		hideChartTooltip();
		vi.unstubAllGlobals();
	});

	const tooltip = () => document.querySelector('.chart-tooltip');
	const pin = (target, options = {}) => togglePinnedChartTooltip(target.id, 30, 40, { target, ...options });
	const flushFrame = () => {
		const pending = [...frames.values()];
		frames.clear();
		pending.forEach(callback => callback());
	};

	it('toggles the same mark after a real mousedown, including descendants of a group', () => {
		pin(first);
		expect(isTooltipPinned()).toBe(true);
		first.querySelector('circle').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		expect(isTooltipPinned()).toBe(true);
		pin(first);
		expect(isTooltipPinned()).toBe(false);
		expect(tooltip().hidden).toBe(true);
		pin(first);
		expect(isTooltipPinned()).toBe(true);
	});

	it('moves the pin to another mark and forgets the previous anchor and listeners', () => {
		const oldAnchor = vi.fn(() => ({ x: 10, y: 20 }));
		const oldDismiss = vi.fn();
		const point = { x: 100, y: 200 };
		pin(first, { anchor: oldAnchor, onDismiss: oldDismiss });
		pin(second, { anchor: () => point });
		oldAnchor.mockClear();
		point.x = 200;
		repositionPinnedTooltip();
		flushFrame();
		expect(tooltip().textContent).toContain('second');
		expect(tooltip().style.left).toBe('212px');
		expect(oldAnchor).not.toHaveBeenCalled();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(tooltip().hidden).toBe(true);
		expect(oldDismiss).not.toHaveBeenCalled();
		pin(first);
		expect(isTooltipPinned()).toBe(true);
	});

	it('ignores hover content, movement and leave events while pinned', () => {
		pin(first);
		flushFrame();
		const content = tooltip().textContent;
		showChartTooltip('another chart', 200, 300);
		moveChartTooltip(400, 500);
		hideHoverTooltip();
		flushFrame();
		expect(tooltip().textContent).toBe(content);
		expect(tooltip().style.left).toBe('42px');
		expect(tooltip().style.top).toBe('52px');
		expect(tooltip().hidden).toBe(false);
		unpinTooltip();
		showChartTooltip('hover resumes', 100, 200);
		expect(tooltip().textContent).toBe('hover resumes');
		hideHoverTooltip();
		expect(tooltip().hidden).toBe(true);
	});

	it.each(['close', 'Escape', 'outside', 'cleanup'])('clears the target on %s without a renderer callback', action => {
		pin(first);
		if (action === 'close') tooltip().querySelector('button').click();
		if (action === 'Escape') document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		if (action === 'outside') second.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		if (action === 'cleanup') hideChartTooltip();
		expect(isTooltipPinned()).toBe(false);
		expect(tooltip().hidden).toBe(true);
		pin(first);
		expect(isTooltipPinned()).toBe(true);
	});

	it.each(['mark', 'overlay'])('recovers when the pinned %s is removed from the DOM', removed => {
		const onDismiss = vi.fn();
		pin(first, { onDismiss });
		if (removed === 'mark') first.remove();
		else tooltip().remove();
		showChartTooltip('new hover', 50, 60);
		flushFrame();
		expect(isTooltipPinned()).toBe(false);
		expect(tooltip().textContent).toBe('new hover');
		expect(tooltip().style.left).toBe('62px');
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(onDismiss).not.toHaveBeenCalled();
		pin(second);
		expect(isTooltipPinned()).toBe(true);
	});

	it('hides and clears the pin before notifying an optional dismiss observer', () => {
		const onDismiss = vi.fn(() => {
			expect(isTooltipPinned()).toBe(false);
			expect(tooltip().hidden).toBe(true);
			hideChartTooltip();
		});
		pin(first, { onDismiss });
		tooltip().querySelector('button').click();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});
});
