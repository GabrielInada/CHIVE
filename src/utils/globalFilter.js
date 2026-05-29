/**
 * CHIVE dataset-wide global filter.
 *
 * Multi-rule filter pipeline applied BEFORE any per-chart filtering. Used
 * across panelManager (when building chart snapshots), chartDefaults (when
 * resolving the active filter), and the global filter dialog component.
 *
 * Migrates legacy single-rule filters (pre-2.0) into the rules-array shape
 * on the fly via {@link normalizeGlobalFilter}, direct callers should
 * always run input through normalize before reading.
 *
 * @typedef {import('../types.js').GlobalFilter} GlobalFilter
 * @typedef {import('../types.js').GlobalFilterRule} GlobalFilterRule
 */

import {
	applyChartFilterRows,
	createDefaultFilterConfig,
	normalizeFilterConfig,
} from './chartFilters.js';

/**
 * Create a fresh, empty global filter.
 *
 * @returns {GlobalFilter}
 */
export function createEmptyGlobalFilter() {
	return { rules: [], combine: 'AND' };
}

/**
 * Build a global filter consisting of a single categorical rule that
 * includes one token. Used by chart tooltip "Show only this" actions.
 * Returns an empty filter when either input is invalid.
 *
 * @param {string} column
 * @param {string} token - Categorical token (use {@link toCategoryToken} on raw values).
 * @returns {GlobalFilter}
 */
export function createSingleCategoryGlobalFilter(column, token) {
	if (typeof column !== 'string' || column.trim().length === 0) {
		return createEmptyGlobalFilter();
	}

	if (typeof token !== 'string' || token.length === 0) {
		return createEmptyGlobalFilter();
	}

	return {
		rules: [{ column, mode: 'categorical', include: [token] }],
		combine: 'AND',
	};
}

/** @private */
function isLegacySingleFilter(raw) {
	if (!raw || typeof raw !== 'object') return false;
	if (Array.isArray(raw.rules)) return false;
	return 'column' in raw || 'include' in raw || 'operator' in raw || 'mode' in raw;
}

/** @private */
function ruleHasColumn(rule) {
	if (!rule || typeof rule !== 'object') return false;
	if (typeof rule.column !== 'string') return false;
	return rule.column.trim().length > 0;
}

/**
 * Coerce any input into the canonical {@link GlobalFilter} shape. Handles
 * three input shapes:
 *   1. The canonical `{ rules, combine }` (current).
 *   2. A legacy single-rule filter (no `rules` array, but has `column` /
 *      `include` / `operator` / `mode`), promoted to a single-rule array.
 *   3. Anything else, collapses to an empty filter.
 *
 * Rules without a column are filtered out; remaining rules are individually
 * normalized via {@link normalizeFilterConfig}.
 *
 * @param {*} rawFilter
 * @param {string[]} [numericColumns=[]] - Columns to treat as numeric when normalizing rule modes.
 * @returns {GlobalFilter}
 */
export function normalizeGlobalFilter(rawFilter, numericColumns = []) {
	if (!rawFilter || typeof rawFilter !== 'object') {
		return createEmptyGlobalFilter();
	}

	if (isLegacySingleFilter(rawFilter)) {
		const base = createEmptyGlobalFilter();
		if (!ruleHasColumn(rawFilter)) {
			return base;
		}
		base.rules.push(normalizeFilterConfig(rawFilter, numericColumns));
		return base;
	}

	const rules = Array.isArray(rawFilter.rules) ? rawFilter.rules : [];
	const normalized = rules
		.filter(rule => ruleHasColumn(rule))
		.map(rule => normalizeFilterConfig(rule, numericColumns));

	return {
		rules: normalized,
		combine: 'AND',
	};
}

/**
 * Whether `rawFilter` has any active rules after normalization.
 *
 * @param {*} rawFilter
 * @returns {boolean}
 */
export function isGlobalFilterActive(rawFilter) {
	const normalized = normalizeGlobalFilter(rawFilter);
	return normalized.rules.length > 0;
}

/**
 * Count the active rules in `rawFilter` after normalization. Used to drive
 * the tab badge in the filter button.
 *
 * @param {*} rawFilter
 * @returns {number}
 */
export function countGlobalFilterRules(rawFilter) {
	const normalized = normalizeGlobalFilter(rawFilter);
	return normalized.rules.length;
}

/**
 * Strip rules whose `column` is no longer present in `availableColumns`.
 * Called before applying a saved filter to a dataset that may have lost
 * columns (e.g. after a join). When ALL rules survive trimming OR NONE
 * survive AND none existed, returns an empty filter; otherwise returns
 * just the surviving rules.
 *
 * @param {*} rawFilter
 * @param {string[]} availableColumns
 * @returns {GlobalFilter}
 */
export function resolveGlobalFilterForColumns(rawFilter, availableColumns) {
	const normalized = normalizeGlobalFilter(rawFilter);
	if (!Array.isArray(availableColumns)) {
		return createEmptyGlobalFilter();
	}

	const safeRules = normalized.rules.filter(rule => availableColumns.includes(rule.column));

	if (safeRules.length === normalized.rules.length && safeRules.length === 0) {
		return createEmptyGlobalFilter();
	}

	return {
		rules: safeRules,
		combine: 'AND',
	};
}

/**
 * Apply every rule in `rawFilter` to `rows` in sequence (AND semantics).
 * Returns the input array unchanged when no rules are active. The pipeline
 * is row-monotonic, each rule narrows the surviving set, never expands it.
 *
 * @param {Array<Object<string, *>>} rows
 * @param {*} rawFilter
 * @param {string[]} [numericColumns=[]]
 * @returns {Array<Object<string, *>>}
 */
export function applyGlobalFilterRules(rows, rawFilter, numericColumns = []) {
	if (!Array.isArray(rows)) return [];
	const normalized = normalizeGlobalFilter(rawFilter, numericColumns);
	if (normalized.rules.length === 0) return rows;

	return normalized.rules.reduce((acc, rule) => {
		return applyChartFilterRows(acc, rule, numericColumns);
	}, rows);
}

/**
 * Add a categorical `token` to the include set for `column`. Creates a new
 * rule when no categorical rule exists for that column; otherwise updates
 * the existing rule. Also removes the same token from the exclude set,
 * since include + exclude on the same token would be contradictory.
 *
 * Used by chart tooltip "Add to filter" actions.
 *
 * @param {*} rawFilter
 * @param {string} column
 * @param {string} token
 * @returns {GlobalFilter}
 */
export function mergeIncludeTokenIntoFilter(rawFilter, column, token) {
	const normalized = normalizeGlobalFilter(rawFilter);
	if (typeof column !== 'string' || column.trim().length === 0) return normalized;
	if (typeof token !== 'string' || token.length === 0) return normalized;

	const idx = normalized.rules.findIndex(
		rule => rule.column === column && rule.mode === 'categorical',
	);

	if (idx === -1) {
		normalized.rules.push({ column, mode: 'categorical', include: [token], exclude: [] });
		return normalized;
	}

	const rule = normalized.rules[idx];
	const include = Array.isArray(rule.include) ? rule.include : [];
	const exclude = Array.isArray(rule.exclude) ? rule.exclude : [];
	const nextExclude = exclude.filter(item => item !== token);
	if (include.includes(token)) {
		if (nextExclude.length === exclude.length) return normalized;
		normalized.rules[idx] = { ...rule, exclude: nextExclude };
		return normalized;
	}

	normalized.rules[idx] = { ...rule, include: [...include, token], exclude: nextExclude };
	return normalized;
}

/**
 * Symmetric counterpart to {@link mergeIncludeTokenIntoFilter}. Add `token`
 * to the exclude set; remove it from include if present.
 *
 * @param {*} rawFilter
 * @param {string} column
 * @param {string} token
 * @returns {GlobalFilter}
 */
export function excludeTokenFromFilter(rawFilter, column, token) {
	const normalized = normalizeGlobalFilter(rawFilter);
	if (typeof column !== 'string' || column.trim().length === 0) return normalized;
	if (typeof token !== 'string' || token.length === 0) return normalized;

	const idx = normalized.rules.findIndex(
		rule => rule.column === column && rule.mode === 'categorical',
	);

	if (idx === -1) {
		normalized.rules.push({ column, mode: 'categorical', include: [], exclude: [token] });
		return normalized;
	}

	const rule = normalized.rules[idx];
	const include = Array.isArray(rule.include) ? rule.include : [];
	const exclude = Array.isArray(rule.exclude) ? rule.exclude : [];
	const nextInclude = include.filter(item => item !== token);
	if (exclude.includes(token)) {
		if (nextInclude.length === include.length) return normalized;
		normalized.rules[idx] = { ...rule, include: nextInclude };
		return normalized;
	}

	normalized.rules[idx] = { ...rule, include: nextInclude, exclude: [...exclude, token] };
	return normalized;
}

/**
 * Remove `token` from the include set on the matching categorical rule.
 * When the rule's include AND exclude sets both become empty, the rule
 * itself is dropped from the filter (since an empty active rule would
 * filter out all rows, see {@link applyChartFilterRows}).
 *
 * @param {*} rawFilter
 * @param {string} column
 * @param {string} token
 * @returns {GlobalFilter}
 */
export function removeIncludeTokenFromFilter(rawFilter, column, token) {
	const normalized = normalizeGlobalFilter(rawFilter);
	if (typeof column !== 'string' || column.trim().length === 0) return normalized;
	if (typeof token !== 'string' || token.length === 0) return normalized;

	const idx = normalized.rules.findIndex(
		rule => rule.column === column && rule.mode === 'categorical',
	);
	if (idx === -1) return normalized;

	const rule = normalized.rules[idx];
	const include = Array.isArray(rule.include) ? rule.include : [];
	const exclude = Array.isArray(rule.exclude) ? rule.exclude : [];
	const nextInclude = include.filter(item => item !== token);

	if (nextInclude.length === include.length) return normalized;

	if (nextInclude.length === 0 && exclude.length === 0) {
		normalized.rules.splice(idx, 1);
		return normalized;
	}

	normalized.rules[idx] = { ...rule, include: nextInclude };
	return normalized;
}

/**
 * Symmetric counterpart to {@link removeIncludeTokenFromFilter}. Removes
 * `token` from the exclude set, and drops the rule when both sets become
 * empty.
 *
 * @param {*} rawFilter
 * @param {string} column
 * @param {string} token
 * @returns {GlobalFilter}
 */
export function removeExcludeTokenFromFilter(rawFilter, column, token) {
	const normalized = normalizeGlobalFilter(rawFilter);
	if (typeof column !== 'string' || column.trim().length === 0) return normalized;
	if (typeof token !== 'string' || token.length === 0) return normalized;

	const idx = normalized.rules.findIndex(
		rule => rule.column === column && rule.mode === 'categorical',
	);
	if (idx === -1) return normalized;

	const rule = normalized.rules[idx];
	const include = Array.isArray(rule.include) ? rule.include : [];
	const exclude = Array.isArray(rule.exclude) ? rule.exclude : [];
	const nextExclude = exclude.filter(item => item !== token);

	if (nextExclude.length === exclude.length) return normalized;

	if (include.length === 0 && nextExclude.length === 0) {
		normalized.rules.splice(idx, 1);
		return normalized;
	}

	normalized.rules[idx] = { ...rule, exclude: nextExclude };
	return normalized;
}

/**
 * Returns true when "Show only this" would produce the same end state as
 * "Add to filter" for the given (column, token). Used by chart tooltips to
 * hide the redundant action when both buttons would do the same thing.
 *
 * Concretely: the action is redundant when the current filter has no rules
 * at all, or has exactly one categorical rule for this column whose include
 * and exclude sets are subsets of {token}.
 */
export function isShowOnlyThisRedundant(rawFilter, column, token) {
	if (typeof column !== 'string' || column.trim().length === 0) return false;
	if (typeof token !== 'string' || token.length === 0) return false;

	const normalized = normalizeGlobalFilter(rawFilter);
	const rules = normalized.rules;
	if (rules.length === 0) return true;
	if (rules.length > 1) return false;

	const rule = rules[0];
	if (rule.column !== column) return false;
	if (rule.mode !== 'categorical') return false;

	const include = Array.isArray(rule.include) ? rule.include : [];
	const exclude = Array.isArray(rule.exclude) ? rule.exclude : [];
	if (include.length > 1) return false;
	if (include.length === 1 && include[0] !== token) return false;
	if (exclude.length > 1) return false;
	if (exclude.length === 1 && exclude[0] !== token) return false;
	return true;
}

/**
 * Look up the current filter state of one (column, token) pair. Drives
 * the tristate UI for filter badges in chart tooltips.
 *
 * @param {*} rawFilter
 * @param {string} column
 * @param {string} token
 * @returns {'included' | 'excluded' | null} `null` when no rule matches the column, or when the token is not present in either set.
 */
export function getTokenFilterState(rawFilter, column, token) {
	if (typeof column !== 'string' || column.trim().length === 0) return null;
	if (typeof token !== 'string' || token.length === 0) return null;

	const normalized = normalizeGlobalFilter(rawFilter);
	const rule = normalized.rules.find(
		r => r.column === column && r.mode === 'categorical',
	);
	if (!rule) return null;

	const include = Array.isArray(rule.include) ? rule.include : [];
	const exclude = Array.isArray(rule.exclude) ? rule.exclude : [];
	if (exclude.includes(token)) return 'excluded';
	if (include.includes(token)) return 'included';
	return null;
}

/**
 * Compatibility alias for {@link createEmptyGlobalFilter}. Both functions
 * return the same shape, distinct names exist because "create empty"
 * reads better at construction sites while "create default" reads better
 * at reset sites.
 *
 * @returns {GlobalFilter}
 */
export function createDefaultGlobalFilter() {
	return createEmptyGlobalFilter();
}

/**
 * Re-export to keep downstream callers that pull a single-rule default
 * working without reaching into `chartFilters.js` directly.
 */
export { createDefaultFilterConfig };