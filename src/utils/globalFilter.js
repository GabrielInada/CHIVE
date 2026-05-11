import {
	applyChartFilterRows,
	createDefaultFilterConfig,
	normalizeFilterConfig,
} from './chartFilters.js';

export function createEmptyGlobalFilter() {
	return { rules: [], combine: 'AND' };
}

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

function isLegacySingleFilter(raw) {
	if (!raw || typeof raw !== 'object') return false;
	if (Array.isArray(raw.rules)) return false;
	return 'column' in raw || 'include' in raw || 'operator' in raw || 'mode' in raw;
}

function ruleHasColumn(rule) {
	if (!rule || typeof rule !== 'object') return false;
	if (typeof rule.column !== 'string') return false;
	return rule.column.trim().length > 0;
}

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

export function isGlobalFilterActive(rawFilter) {
	const normalized = normalizeGlobalFilter(rawFilter);
	return normalized.rules.length > 0;
}

export function countGlobalFilterRules(rawFilter) {
	const normalized = normalizeGlobalFilter(rawFilter);
	return normalized.rules.length;
}

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

export function applyGlobalFilterRules(rows, rawFilter, numericColumns = []) {
	if (!Array.isArray(rows)) return [];
	const normalized = normalizeGlobalFilter(rawFilter, numericColumns);
	if (normalized.rules.length === 0) return rows;

	return normalized.rules.reduce((acc, rule) => {
		return applyChartFilterRows(acc, rule, numericColumns);
	}, rows);
}

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

// Compatibility alias: create a new empty filter config (for reset).
export function createDefaultGlobalFilter() {
	return createEmptyGlobalFilter();
}

// Re-export to keep downstream callers that pull a single-rule default working.
export { createDefaultFilterConfig };