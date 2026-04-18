export const FILTER_MISSING_TOKEN = '__chive_missing__';
export const FILTER_CATEGORY_LIMIT = 50;

const NUMERIC_OPERATORS = new Set(['between', 'lt', 'gt', 'eq']);

export function createDefaultFilterConfig() {
  return {
    column: null,
    mode: 'categorical',
    include: [],
    search: '',
    operator: 'between',
    min: '',
    max: '',
    value: '',
  };
}

import { isEmptyValue } from './formatters.js';

export function isMissingCategoryValue(value) {
  return isEmptyValue(value);
}

export function toCategoryToken(value) {
  if (isMissingCategoryValue(value)) return FILTER_MISSING_TOKEN;
  return `v:${String(value)}`;
}

export function normalizeFilterConfig(rawFilter, numericColumns = []) {
  const base = createDefaultFilterConfig();
  const filter = rawFilter && typeof rawFilter === 'object' ? rawFilter : {};
  const column = typeof filter.column === 'string' && filter.column.trim().length > 0
    ? filter.column
    : null;
  const mode = column && numericColumns.includes(column)
    ? 'numeric'
    : 'categorical';
  const operator = NUMERIC_OPERATORS.has(filter.operator) ? filter.operator : 'between';

  return {
    ...base,
    ...filter,
    column,
    mode,
    include: Array.isArray(filter.include)
      ? Array.from(new Set(filter.include.map(item => String(item))))
      : [],
    search: typeof filter.search === 'string' ? filter.search : '',
    operator,
  };
}

export function getCategoricalFilterOptions(rows, columnName, options = {}) {
  const {
    search = '',
    limit = FILTER_CATEGORY_LIMIT,
    missingLabel = '(missing)',
  } = options;

  if (!Array.isArray(rows) || !columnName) {
    return { options: [], allTokens: [], total: 0, hasMore: false };
  }

  const map = new Map();
  rows.forEach(row => {
    const rawValue = row?.[columnName];
    const token = toCategoryToken(rawValue);
    const label = token === FILTER_MISSING_TOKEN ? missingLabel : String(rawValue);
    const prev = map.get(token);
    map.set(token, {
      token,
      label,
      count: (prev?.count || 0) + 1,
    });
  });

  const normalizedSearch = String(search).trim().toLowerCase();
  const allOptions = Array.from(map.values())
    .filter(item => normalizedSearch.length === 0 || item.label.toLowerCase().includes(normalizedSearch))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });

  const visibleOptions = allOptions.slice(0, Math.max(0, Number(limit) || FILTER_CATEGORY_LIMIT));

  return {
    options: visibleOptions,
    allTokens: allOptions.map(item => item.token),
    total: allOptions.length,
    hasMore: allOptions.length > visibleOptions.length,
  };
}

function parseNumericValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function applyChartFilterRows(rows, rawFilter, numericColumns = []) {
  if (!Array.isArray(rows)) return [];

  const filter = normalizeFilterConfig(rawFilter, numericColumns);
  if (!filter.column) return rows;

  if (filter.mode === 'numeric') {
    if (!NUMERIC_OPERATORS.has(filter.operator)) return rows;

    if (filter.operator === 'between') {
      const min = parseNumericValue(filter.min);
      const max = parseNumericValue(filter.max);
      if (min === null || max === null) return rows;
      const low = Math.min(min, max);
      const high = Math.max(min, max);
      return rows.filter(row => {
        const value = parseNumericValue(row?.[filter.column]);
        return value !== null && value >= low && value <= high;
      });
    }

    const target = parseNumericValue(filter.value);
    if (target === null) return rows;

    if (filter.operator === 'lt') {
      return rows.filter(row => {
        const value = parseNumericValue(row?.[filter.column]);
        return value !== null && value < target;
      });
    }

    if (filter.operator === 'gt') {
      return rows.filter(row => {
        const value = parseNumericValue(row?.[filter.column]);
        return value !== null && value > target;
      });
    }

    return rows.filter(row => {
      const value = parseNumericValue(row?.[filter.column]);
      return value !== null && value === target;
    });
  }

  const includeSet = new Set(filter.include.map(value => String(value)));
  if (includeSet.size === 0) return [];

  return rows.filter(row => includeSet.has(toCategoryToken(row?.[filter.column])));
}
