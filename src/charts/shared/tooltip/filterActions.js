/**
 * Global-filter actions in pinned chart tooltips.
 *
 * A chart names the categories a pinned tooltip is about, each by its column
 * and category token, and hands over its filter callbacks as it received them.
 * This module reads each category's state in the global filter, decides which
 * actions apply, fills in label defaults, adds the state badge, and shows the
 * pinned tooltip. Used by the bar, pie, treemap, bubble and network renderers
 * and by `scatter/interaction.js`.
 *
 * @typedef {Object} FilterCallbacks
 * @property {(column: string, token: string) => void} [onFocusGlobalFilter]
 * @property {(column: string, token: string) => void} [onAddToGlobalFilter]
 * @property {(column: string, token: string) => void} [onExcludeGlobalFilter]
 * @property {(column: string, token: string) => void} [onRemoveFromGlobalFilter]
 * @property {(column: string, token: string) => void} [onBringBackGlobalFilter]
 * @property {(column: string, token: string) => 'included'|'excluded'|null} [getTokenFilterState]
 * @property {(column: string, token: string) => boolean} [isShowOnlyThisRedundant]
 * @property {Object<string, string>} [filterActionLabels] - Localized labels by name. This module reads focus, add, exclude, remove, bringBack, stateIncluded, stateExcluded and close; a missing one falls back to its English default.
 *
 * @typedef {Object} FilterCategory
 * @property {?string} column - Dataset column the category belongs to.
 * @property {?string} token - The category token global filter rules use for it.
 * @property {string} [heading] - Text above its actions, for a tooltip about more than one category.
 */

import { createFilterStateBadge, createNamedActionGroup } from './content.js';
import { showPinnedChartTooltip } from './tooltip.js';

const DEFAULT_ACTION_LABELS = Object.freeze({
	focus: 'Show only this',
	add: 'Add to filter',
	exclude: 'Hide this',
	remove: 'Remove from filter',
	bringBack: 'Bring back',
});

/**
 * Build the action definitions for one category from its filter state. An
 * action appears only when its callback is a function.
 *
 * @private
 * @param {string} column
 * @param {string} token
 * @param {'included'|'excluded'|null} state
 * @param {FilterCallbacks} callbacks
 * @returns {Array<{ label: string, variant?: string, onClick: () => void }>}
 */
function buildCategoryActions(column, token, state, callbacks) {
	const labels = callbacks.filterActionLabels || {};
	const label = name => labels[name] || DEFAULT_ACTION_LABELS[name];
	const actions = [];
	const offer = (callback, name, variant) => {
		if (typeof callback !== 'function') return;
		actions.push({ label: label(name), variant, onClick: () => callback(column, token) });
	};

	const focusIsRedundant = typeof callbacks.isShowOnlyThisRedundant === 'function'
		&& !!callbacks.isShowOnlyThisRedundant(column, token);
	if (!focusIsRedundant) offer(callbacks.onFocusGlobalFilter, 'focus', 'primary');
	if (state === 'included') {
		offer(callbacks.onRemoveFromGlobalFilter, 'remove');
	} else if (state === 'excluded') {
		offer(callbacks.onBringBackGlobalFilter, 'bringBack');
	} else {
		offer(callbacks.onAddToGlobalFilter, 'add');
		offer(callbacks.onExcludeGlobalFilter, 'exclude', 'danger');
	}
	return actions;
}

/**
 * Show a pinned tooltip with the global-filter actions for the categories it
 * is about.
 *
 * Each category offers "Show only this", unless `isShowOnlyThisRedundant`
 * says it would give the same filter as adding the category, and then by its
 * state: "Add to filter" and "Hide this" when the filter does not name it,
 * "Remove from filter" when the filter includes it, and "Bring back" when the
 * filter excludes it. An action appears only when its callback is a function,
 * and a category without a column or a token offers none. A tooltip about one
 * category also shows a badge when the filter includes or excludes it; a
 * tooltip about two shows each category's actions under its heading and no
 * badge.
 *
 * @param {Node|string} content - Tooltip body.
 * @param {number} x - Page X coordinate.
 * @param {number} y - Page Y coordinate.
 * @param {Object} [options]
 * @param {string} [options.headerTitle]
 * @param {() => void} [options.onDismiss]
 * @param {() => { x: number, y: number }} [options.anchor] - See `pinTooltip`.
 * @param {FilterCallbacks} [options.filterCallbacks] - The chart's filter callbacks, as it received them.
 * @param {FilterCategory[]} [options.categories]
 * @returns {void}
 */
export function showPinnedFilterTooltip(content, x, y, {
	headerTitle,
	onDismiss,
	anchor,
	filterCallbacks,
	categories = [],
} = {}) {
	const callbacks = filterCallbacks || {};
	const labels = callbacks.filterActionLabels || {};
	const named = categories
		.filter(category => category?.column && category.token)
		.map(category => ({
			...category,
			state: typeof callbacks.getTokenFilterState === 'function'
				? callbacks.getTokenFilterState(category.column, category.token)
				: null,
		}));
	const actionSets = [];
	for (const { column, token, state, heading } of named) {
		const actions = buildCategoryActions(column, token, state, callbacks);
		if (actions.length > 0) actionSets.push(createNamedActionGroup(actions, heading));
	}
	const stateBadge = named.length === 1
		? createFilterStateBadge({
			state: named[0].state,
			includedLabel: labels.stateIncluded,
			excludedLabel: labels.stateExcluded,
		})
		: null;
	showPinnedChartTooltip(content, x, y, {
		headerTitle,
		closeLabel: labels.close,
		onDismiss,
		anchor,
		actionSets,
		stateBadge,
	});
}
