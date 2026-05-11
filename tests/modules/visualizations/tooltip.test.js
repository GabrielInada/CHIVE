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
	let createTooltipActionGroup;
	let createTooltipExcludeAction;
	let showPinnedChartTooltip;
	let buildCategoricalFilterActions;
	let createFilterStateBadge;

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
		createTooltipActionGroup = mod.createTooltipActionGroup;
		createTooltipExcludeAction = mod.createTooltipExcludeAction;
		showPinnedChartTooltip = mod.showPinnedChartTooltip;
		buildCategoricalFilterActions = mod.buildCategoricalFilterActions;
		createFilterStateBadge = mod.createFilterStateBadge;
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

	it('createTooltipActionGroup renders multiple keyboard-focusable actions', () => {
		const calls = [];
		const group = createTooltipActionGroup([
			{ label: 'Focus', variant: 'primary', onClick: () => calls.push('focus') },
			{ label: 'Add', onClick: () => calls.push('add') },
		]);

		expect(group.className).toBe('chart-tooltip__actions');
		expect(group.getAttribute('role')).toBe('group');
		expect(group.querySelectorAll('button')).toHaveLength(2);

		group.querySelectorAll('button')[0].click();
		group.querySelectorAll('button')[1].click();
		expect(calls).toEqual(['focus', 'add']);
	});

	it('createTooltipExcludeAction returns a danger-variant button', () => {
		const button = createTooltipExcludeAction({ label: 'Hide', onClick: () => {} });
		expect(button.className).toContain('chart-tooltip__action');
		expect(button.className).toContain('chart-tooltip__action--danger');
	});

	it('createTooltipActionGroup renders disabled buttons that do not invoke onClick', () => {
		const calls = [];
		const group = createTooltipActionGroup([
			{ label: 'Off', disabled: true, onClick: () => calls.push('off') },
		]);
		const button = group.querySelector('button');
		expect(button.disabled).toBe(true);
		expect(button.getAttribute('aria-disabled')).toBe('true');
		button.click();
		expect(calls).toEqual([]);
	});

	it('showPinnedChartTooltip renders a header with title and a working close button', () => {
		const onDismiss = vi.fn();
		const content = document.createElement('div');
		content.textContent = 'category info';
		showPinnedChartTooltip(content, 100, 100, {
			headerTitle: 'My Category',
			onDismiss,
			closeLabel: 'Close',
			actionSets: [],
		});

		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip.classList.contains('chart-tooltip--fixado')).toBe(true);
		const titleEl = tooltip.querySelector('.chart-tooltip__header-title');
		expect(titleEl.textContent).toBe('My Category');
		const closeBtn = tooltip.querySelector('.chart-tooltip__close');
		expect(closeBtn).not.toBeNull();
		closeBtn.click();
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it('Escape key dismisses a pinned tooltip with onDismiss', () => {
		const onDismiss = vi.fn();
		showPinnedChartTooltip(document.createElement('div'), 100, 100, {
			headerTitle: 'X',
			onDismiss,
		});
		const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
		document.dispatchEvent(event);
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it('Escape on an unpinned tooltip is a no-op', () => {
		showChartTooltip('hover', 0, 0);
		const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
		// should not throw and should not dismiss
		document.dispatchEvent(event);
		const tooltip = document.querySelector('.chart-tooltip');
		expect(tooltip.style.display).toBe('block');
	});

	it('mousedown outside the pinned tooltip dismisses it', () => {
		const onDismiss = vi.fn();
		showPinnedChartTooltip(document.createElement('div'), 100, 100, {
			headerTitle: 'Y',
			onDismiss,
		});
		const outside = document.createElement('div');
		document.body.appendChild(outside);
		const event = new MouseEvent('mousedown', { bubbles: true });
		outside.dispatchEvent(event);
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it('mousedown inside the pinned tooltip does not dismiss it', () => {
		const onDismiss = vi.fn();
		showPinnedChartTooltip(document.createElement('div'), 100, 100, {
			headerTitle: 'Z',
			onDismiss,
		});
		const tooltip = document.querySelector('.chart-tooltip');
		const event = new MouseEvent('mousedown', { bubbles: true });
		tooltip.dispatchEvent(event);
		expect(onDismiss).not.toHaveBeenCalled();
	});

	it('buildCategoricalFilterActions returns Show only / Add / Hide for unfiltered token', () => {
		const calls = [];
		const actions = buildCategoricalFilterActions({
			column: 'col',
			token: 'v:apple',
			state: null,
			labels: { focus: 'Focus', add: 'Add', exclude: 'Hide', remove: 'Rm', bringBack: 'Back' },
			onFocus: (c, t) => calls.push(['focus', c, t]),
			onAdd: (c, t) => calls.push(['add', c, t]),
			onExclude: (c, t) => calls.push(['excl', c, t]),
			onRemove: (c, t) => calls.push(['rm', c, t]),
			onBringBack: (c, t) => calls.push(['back', c, t]),
		});
		expect(actions.map(a => a.label)).toEqual(['Focus', 'Add', 'Hide']);
		actions[0].onClick();
		actions[1].onClick();
		actions[2].onClick();
		expect(calls).toEqual([
			['focus', 'col', 'v:apple'],
			['add', 'col', 'v:apple'],
			['excl', 'col', 'v:apple'],
		]);
		expect(actions[0].variant).toBe('primary');
		expect(actions[2].variant).toBe('danger');
	});

	it('buildCategoricalFilterActions swaps Add for Remove when token is included', () => {
		const actions = buildCategoricalFilterActions({
			column: 'col',
			token: 'v:apple',
			state: 'included',
			labels: { focus: 'Focus', add: 'Add', exclude: 'Hide', remove: 'Rm', bringBack: 'Back' },
			onFocus: () => {},
			onAdd: () => {},
			onExclude: () => {},
			onRemove: () => {},
			onBringBack: () => {},
		});
		expect(actions.map(a => a.label)).toEqual(['Focus', 'Rm']);
	});

	it('buildCategoricalFilterActions omits the focus action when omitFocus is true', () => {
		const actions = buildCategoricalFilterActions({
			column: 'col',
			token: 'v:apple',
			state: null,
			omitFocus: true,
			labels: { focus: 'Focus', add: 'Add', exclude: 'Hide', remove: 'Rm', bringBack: 'Back' },
			onFocus: () => {},
			onAdd: () => {},
			onExclude: () => {},
		});
		expect(actions.map(a => a.label)).toEqual(['Add', 'Hide']);
	});

	it('buildCategoricalFilterActions shows Bring back when token is excluded', () => {
		const actions = buildCategoricalFilterActions({
			column: 'col',
			token: 'v:apple',
			state: 'excluded',
			labels: { focus: 'Focus', add: 'Add', exclude: 'Hide', remove: 'Rm', bringBack: 'Back' },
			onFocus: () => {},
			onAdd: () => {},
			onExclude: () => {},
			onRemove: () => {},
			onBringBack: () => {},
		});
		expect(actions.map(a => a.label)).toEqual(['Focus', 'Back']);
	});

	it('createFilterStateBadge returns null when state is null and a styled element when set', () => {
		expect(createFilterStateBadge({ state: null })).toBeNull();
		const included = createFilterStateBadge({ state: 'included', includedLabel: 'In filter' });
		expect(included.className).toContain('chart-tooltip__filter-state--included');
		expect(included.textContent).toContain('In filter');
		const excluded = createFilterStateBadge({ state: 'excluded', excludedLabel: 'Excluded' });
		expect(excluded.className).toContain('chart-tooltip__filter-state--excluded');
	});
});
