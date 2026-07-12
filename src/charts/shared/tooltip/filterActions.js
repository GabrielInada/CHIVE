/**
 * Categorical filter-action definitions for chart tooltips.
 *
 * Pure mapping from a token's current global-filter state to the set of
 * actions a pinned tooltip should offer. Returns plain definition objects, not
 * DOM: the renderers feed them to `createTooltipActionGroup` /
 * `createNamedActionGroup` (in `content.js`) to build the buttons.
 */

/**
 * Build the canonical action set for a categorical filter token.
 *
 * @param {Object} params
 * @param {string} params.column - dataset column name
 * @param {string} params.token - already-tokenized value (use toCategoryToken)
 * @param {'included'|'excluded'|null} params.state - current state in the global filter
 * @param {Object} params.labels - localized labels: focus, add, exclude, remove, bringBack
 * @param {Function} [params.onFocus] - (column, token) => void
 * @param {Function} [params.onAdd] - (column, token) => void
 * @param {Function} [params.onExclude] - (column, token) => void
 * @param {Function} [params.onRemove] - (column, token) => void  // remove from include
 * @param {Function} [params.onBringBack] - (column, token) => void  // remove from exclude
 * @returns {Array<Object>} action definition objects (`{ label, variant?, onClick }`) for createTooltipActionGroup
 */
export function buildCategoricalFilterActions({ column, token, state, labels = {}, omitFocus = false, onFocus, onAdd, onExclude, onRemove, onBringBack }) {
	const actions = [];
	if (typeof onFocus === 'function' && !omitFocus) {
		actions.push({
			label: labels.focus || 'Show only this',
			variant: 'primary',
			onClick: () => onFocus(column, token),
		});
	}
	if (state === 'included') {
		if (typeof onRemove === 'function') {
			actions.push({
				label: labels.remove || 'Remove from filter',
				onClick: () => onRemove(column, token),
			});
		}
	} else if (state === 'excluded') {
		if (typeof onBringBack === 'function') {
			actions.push({
				label: labels.bringBack || 'Bring back',
				onClick: () => onBringBack(column, token),
			});
		}
	} else {
		if (typeof onAdd === 'function') {
			actions.push({
				label: labels.add || 'Add to filter',
				onClick: () => onAdd(column, token),
			});
		}
		if (typeof onExclude === 'function') {
			actions.push({
				label: labels.exclude || 'Hide this',
				variant: 'danger',
				onClick: () => onExclude(column, token),
			});
		}
	}
	return actions;
}
