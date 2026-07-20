/**
 * Bubble-chart controls: shared nesting-column resolution.
 *
 * Package-private helpers shared by the bubble builder (via `createNestingControls`)
 * and the bubble listeners. They are documented `@internal`; JavaScript does not
 * enforce module privacy.
 */

import { BUBBLE_CHART } from '../../../config/charts/definitions/bubble.js';
import { normalizeColumnNameList } from '../../../domain/datasets/columns.js';

/**
 * Resolve the effective nesting-column list for a bubble config. Normalizes the
 * canonical `nestingColumns` first (type-filter, de-dupe, optional visible-column
 * filter, and the shared depth cap); only when that is empty does it fall back to
 * the legacy single `groupColumn`, routed through the same helper so an empty or
 * non-string group never becomes a `['']` level.
 *
 * @internal
 * @param {Object} config - The bubble chart config block.
 * @param {Set<string> | null} [allowed] - When set, keep only these column names.
 * @returns {string[]}
 */
export function resolveNestingColumnsFromConfig(config, allowed = null) {
	const canonical = normalizeColumnNameList(config.nestingColumns, { allowed, max: BUBBLE_CHART.maxNestingDepth });
	if (canonical.length > 0) return canonical;
	return normalizeColumnNameList([config.groupColumn], { allowed, max: 1 });
}

/**
 * Single source of truth for how many nesting-level selectors exist, used by both
 * the builder (render count) and the listeners (wiring count) so they cannot drift.
 * Flat mode is always a single level. Grouped mode shows the filled levels plus one
 * trailing empty selector only while another level can still be added, bounded by
 * the shared depth cap and the number of eligible columns.
 *
 * @internal
 * @param {Object} config - The bubble chart config block.
 * @param {Set<string> | null} [allowed] - When set, the eligible-column source for the capacity bound.
 * @returns {number}
 */
export function computeNestingControlCount(config, allowed = null) {
	const nestingColumns = resolveNestingColumnsFromConfig(config, allowed);
	const nestingMode = BUBBLE_CHART.nestingModes.includes(config.nestingMode)
		? config.nestingMode
		: BUBBLE_CHART.defaultNestingMode;
	if (nestingMode !== 'grouped') return BUBBLE_CHART.maxInitialNestingControlsVisible;
	const maximumSelectableDepth = allowed
		? Math.min(BUBBLE_CHART.maxNestingDepth, allowed.size)
		: BUBBLE_CHART.maxNestingDepth;
	const canAddLevel = nestingColumns.length < maximumSelectableDepth;
	return Math.max(
		BUBBLE_CHART.maxInitialNestingControlsVisible,
		nestingColumns.length + (canAddLevel ? 1 : 0),
	);
}
