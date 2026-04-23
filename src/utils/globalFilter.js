import {
	applyChartFilterRows,
	createDefaultFilterConfig,
	normalizeFilterConfig,
} from './chartFilters.js';

export function createEmptyGlobalFilter() {
	return { rules: [], combine: 'AND' };
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

// Compatibility alias: create a new empty filter config (for reset).
export function createDefaultGlobalFilter() {
	return createEmptyGlobalFilter();
}

// Re-export to keep downstream callers that pull a single-rule default working.
export { createDefaultFilterConfig };