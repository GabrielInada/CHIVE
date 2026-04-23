import { createDefaultFilterConfig, normalizeFilterConfig } from './chartFilters.js';

export function isGlobalFilterActive(rawFilter) {
	if (!rawFilter || typeof rawFilter !== 'object') return false;
	if (!rawFilter.column || typeof rawFilter.column !== 'string') return false;
	return rawFilter.column.trim().length > 0;
}

export function resolveGlobalFilterForColumns(rawFilter, availableColumns) {
	if (!rawFilter || typeof rawFilter !== 'object') {
		return createDefaultFilterConfig();
	}
	if (!rawFilter.column) {
		return createDefaultFilterConfig();
	}
	if (!Array.isArray(availableColumns) || !availableColumns.includes(rawFilter.column)) {
		return createDefaultFilterConfig();
	}
	return rawFilter;
}

export function normalizeGlobalFilter(rawFilter, numericColumns = []) {
	return normalizeFilterConfig(rawFilter, numericColumns);
}
