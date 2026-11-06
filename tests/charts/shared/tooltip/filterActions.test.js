// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { showPinnedFilterTooltip } from '../../../../src/charts/shared/tooltip/filterActions.js';
import { hideChartTooltip } from '../../../../src/charts/shared/tooltip/tooltip.js';

const LABELS = {
	focus: 'Only',
	add: 'Keep',
	exclude: 'Drop',
	remove: 'Unkeep',
	bringBack: 'Restore',
	stateIncluded: 'Kept',
	stateExcluded: 'Dropped',
	close: 'Dismiss',
};
const NORTH = { column: 'region', token: 'v:North' };

function recordingHandlers(calls) {
	const record = name => (column, token) => calls.push([name, column, token]);
	return {
		onFocusGlobalFilter: record('focus'),
		onAddToGlobalFilter: record('add'),
		onExcludeGlobalFilter: record('exclude'),
		onRemoveFromGlobalFilter: record('remove'),
		onBringBackGlobalFilter: record('bringBack'),
	};
}

function pin(filterCallbacks, categories, options = {}) {
	showPinnedFilterTooltip('Rows: 4', 10, 20, { headerTitle: 'North', filterCallbacks, categories, ...options });
	return document.querySelector('.chart-tooltip');
}

const actionButtons = () => [...document.querySelectorAll('.chart-tooltip__action')];
const actionLabels = () => actionButtons().map(button => button.textContent);
const stateBadge = () => document.querySelector('.chart-tooltip__filter-state');

describe('showPinnedFilterTooltip', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	afterEach(() => {
		hideChartTooltip();
	});

	it('offers Show only this, Add to filter and Hide this for a category the filter does not name', () => {
		const calls = [];
		const tooltip = pin(
			{ ...recordingHandlers(calls), getTokenFilterState: () => null, filterActionLabels: LABELS },
			[NORTH],
		);

		expect(tooltip.classList.contains('chart-tooltip--fixado')).toBe(true);
		expect(tooltip.querySelector('.chart-tooltip__header-title').textContent).toBe('North');
		expect(tooltip.textContent).toContain('Rows: 4');
		expect(actionLabels()).toEqual(['Only', 'Keep', 'Drop']);
		expect(actionButtons()[0].classList.contains('chart-tooltip__action--primary')).toBe(true);
		expect(actionButtons()[2].classList.contains('chart-tooltip__action--danger')).toBe(true);
		expect(stateBadge()).toBeNull();

		actionButtons().forEach(button => button.click());
		expect(calls).toEqual([
			['focus', 'region', 'v:North'],
			['add', 'region', 'v:North'],
			['exclude', 'region', 'v:North'],
		]);
	});

	it.each([
		['included', ['Only', 'Unkeep'], 'remove', 'Kept'],
		['excluded', ['Only', 'Restore'], 'bringBack', 'Dropped'],
	])('offers the actions and the badge of an %s category', (state, labels, action, badgeText) => {
		const calls = [];
		pin({ ...recordingHandlers(calls), getTokenFilterState: () => state, filterActionLabels: LABELS }, [NORTH]);

		expect(actionLabels()).toEqual(labels);
		expect(stateBadge().classList.contains(`chart-tooltip__filter-state--${state}`)).toBe(true);
		expect(stateBadge().textContent).toContain(badgeText);
		actionButtons()[1].click();
		expect(calls).toEqual([[action, 'region', 'v:North']]);
	});

	it('leaves out Show only this when it would give the same filter as adding the category', () => {
		const getTokenFilterState = vi.fn(() => null);
		const isShowOnlyThisRedundant = vi.fn(() => true);
		pin({ ...recordingHandlers([]), getTokenFilterState, isShowOnlyThisRedundant, filterActionLabels: LABELS }, [NORTH]);

		expect(getTokenFilterState).toHaveBeenCalledWith('region', 'v:North');
		expect(isShowOnlyThisRedundant).toHaveBeenCalledWith('region', 'v:North');
		expect(actionLabels()).toEqual(['Keep', 'Drop']);
	});

	it('falls back to the English label when a label is missing or empty', () => {
		const handlers = recordingHandlers([]);
		pin({ ...handlers, getTokenFilterState: () => null, filterActionLabels: { focus: '' } }, [NORTH], { onDismiss: () => {} });
		expect(actionLabels()).toEqual(['Show only this', 'Add to filter', 'Hide this']);
		expect(document.querySelector('.chart-tooltip__close').getAttribute('aria-label')).toBe('Close');

		pin({ ...handlers, getTokenFilterState: () => 'included' }, [NORTH]);
		expect(actionLabels()).toEqual(['Show only this', 'Remove from filter']);
		expect(stateBadge().textContent).toContain('In filter');

		pin({ ...handlers, getTokenFilterState: () => 'excluded' }, [NORTH]);
		expect(actionLabels()).toEqual(['Show only this', 'Bring back']);
		expect(stateBadge().textContent).toContain('Excluded');
	});

	it('offers only the actions whose callback is a function', () => {
		pin({ onFocusGlobalFilter: 'not a function', onAddToGlobalFilter: () => {}, onExcludeGlobalFilter: null }, [NORTH]);

		expect(actionLabels()).toEqual(['Add to filter']);
	});

	it.each([
		['column', { column: null, token: 'v:North' }],
		['token', { column: 'region', token: null }],
	])('offers no actions and no badge for a category without a %s', (_missing, category) => {
		const getTokenFilterState = vi.fn(() => 'included');
		const tooltip = pin({ ...recordingHandlers([]), getTokenFilterState }, [category]);

		expect(tooltip.classList.contains('chart-tooltip--fixado')).toBe(true);
		expect(actionButtons()).toHaveLength(0);
		expect(stateBadge()).toBeNull();
		expect(getTokenFilterState).not.toHaveBeenCalled();
	});

	it('pins the content alone without filter callbacks', () => {
		const tooltip = pin(undefined, [NORTH]);

		expect(tooltip.classList.contains('chart-tooltip--fixado')).toBe(true);
		expect(tooltip.textContent).toContain('Rows: 4');
		expect(actionButtons()).toHaveLength(0);
		expect(stateBadge()).toBeNull();
		expect(tooltip.querySelector('.chart-tooltip__divider')).toBeNull();
	});

	it('shows the actions of two categories under their headings, without a badge', () => {
		const calls = [];
		pin({
			...recordingHandlers(calls),
			getTokenFilterState: column => (column === 'source' ? 'included' : null),
			filterActionLabels: LABELS,
		}, [
			{ column: 'source', token: 'v:A', heading: 'Filter source (source)' },
			{ column: 'target', token: 'v:A', heading: 'Filter target (target)' },
		]);

		const groups = [...document.querySelectorAll('.chart-tooltip__action-set-wrap')];
		expect(groups.map(group => group.querySelector('.chart-tooltip__action-set-label').textContent))
			.toEqual(['Filter source (source)', 'Filter target (target)']);
		expect(groups.map(group => [...group.querySelectorAll('.chart-tooltip__action')].map(button => button.textContent)))
			.toEqual([['Only', 'Unkeep'], ['Only', 'Keep', 'Drop']]);
		expect(stateBadge()).toBeNull();

		groups[1].querySelector('.chart-tooltip__action--danger').click();
		expect(calls).toEqual([['exclude', 'target', 'v:A']]);
	});

	it('shows no heading for a category that offers no actions', () => {
		pin({ onAddToGlobalFilter: () => {}, getTokenFilterState: column => (column === 'source' ? 'included' : null) }, [
			{ column: 'source', token: 'v:A', heading: 'Source' },
			{ column: 'target', token: 'v:A', heading: 'Target' },
		]);

		expect([...document.querySelectorAll('.chart-tooltip__action-set-label')].map(heading => heading.textContent))
			.toEqual(['Target']);
		expect(actionLabels()).toEqual(['Add to filter']);
	});

	it('labels the close button and passes the dismiss handler and the anchor on', () => {
		const onDismiss = vi.fn();
		const anchor = vi.fn(() => ({ x: 30, y: 40 }));
		pin({ filterActionLabels: LABELS }, [], { onDismiss, anchor });

		const close = document.querySelector('.chart-tooltip__close');
		expect(close.getAttribute('aria-label')).toBe('Dismiss');
		expect(anchor).toHaveBeenCalled();
		close.click();
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});
});
