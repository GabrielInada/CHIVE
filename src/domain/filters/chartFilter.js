/**
 * CHIVE chart-level filter primitives.
 *
 * Single-rule filter configs and the categorical option enumeration that
 * powers the filter dialog. {@link globalFilter} composes these into a
 * multi-rule pipeline; the building blocks here are deliberately scoped to
 * one rule at a time.
 *
 * @typedef {import('../../types.js').GlobalFilterRule} GlobalFilterRule
 */

import { isEmptyValue, isNullish, toFiniteNumber } from '../../utils/formatters.js';

/**
 * Sentinel token used to represent missing values (null/undefined/empty
 * string) in the include/exclude sets. Keeps the categorical pipeline
 * monomorphic: every value is a string token.
 *
 * @type {string}
 */
export const FILTER_MISSING_TOKEN = '__chive_missing__';

/**
 * Maximum number of categorical options surfaced in the filter dialog at
 * one time. The dialog shows the top-N by count and exposes the rest via
 * search.
 *
 * @type {number}
 */
export const FILTER_CATEGORY_LIMIT = 50;

const NUMERIC_OPERATORS = new Set(['between', 'lt', 'gt', 'eq']);

/**
 * Build a fresh, empty filter config. All callers that create a new
 * filter creation, including dialog open, "reset" button, and
 * normalization fallback, go
 * through this so the shape stays canonical.
 *
 * @returns {GlobalFilterRule & { exclude: string[], search: string, value: string, min: string, max: string }} Default config with no column selected.
 */
export function createDefaultFilterConfig() {
  return {
    column: null,
    mode: 'categorical',
    include: [],
    exclude: [],
    search: '',
    operator: 'between',
    min: '',
    max: '',
    value: '',
  };
}

/**
 * Test whether a raw cell value should be treated as the "missing" bucket.
 * Delegates to {@link isEmptyValue}; this thin wrapper exists so callers
 * have a name that names the intent.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isMissingCategoryValue(value) {
  return isEmptyValue(value);
}

/**
 * Map a raw cell value to its categorical token. Missing values collapse
 * to {@link FILTER_MISSING_TOKEN}; everything else gets a `'v:'` prefix
 * so user data can never collide with the sentinel.
 *
 * @param {*} value
 * @returns {string}
 */
export function toCategoryToken(value) {
  if (isMissingCategoryValue(value)) return FILTER_MISSING_TOKEN;
  return `v:${String(value)}`;
}

/**
 * String comparator used as a sort tiebreaker across chart renderers.
 * Coerces inputs to `String` so undefined/null are ordered deterministically
 * instead of throwing from `localeCompare`.
 *
 * @param {*} a
 * @param {*} b
 * @returns {number} Negative if `a < b`, positive if `a > b`, `0` if equal.
 */
export function compareStrings(a, b) {
  return String(a).localeCompare(String(b));
}

/**
 * Collapse missing/empty values into a single N/A bucket so they do
 * not fragment categorical series. Used by scatter/bubble grouping.
 *
 * @param {*} value
 * @returns {string} `'N/A'` for missing/empty; `String(value)` otherwise.
 */
export function normalizeCategoryValue(value) {
  return isNullish(value) || value === '' ? 'N/A' : String(value);
}

/**
 * Coerce a possibly-malformed filter config into the canonical shape.
 * Unknown operators fall back to `'between'`; non-string columns collapse
 * to `null`; non-array `include`/`exclude` reset to `[]`. The `mode` field
 * is derived from `numericColumns`. Picking a column that's in the list
 * flips the rule to numeric mode.
 *
 * @param {Object | null | undefined} rawFilter - Possibly-partial filter; defaults applied for missing fields.
 * @param {string[]} [numericColumns=[]] - Column names that should be treated as numeric for mode detection.
 * @returns {GlobalFilterRule & { exclude: string[], search: string, value: string, min: string, max: string }}
 */
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
    exclude: Array.isArray(filter.exclude)
      ? Array.from(new Set(filter.exclude.map(item => String(item))))
      : [],
    search: typeof filter.search === 'string' ? filter.search : '',
    operator,
  };
}

/**
 * Enumerate the distinct categorical values present in `rows` for the
 * given column, sorted by descending count then by label. Used to render
 * the categorical filter dialog's option list.
 *
 * @param {Array<Object<string, *>>} rows - Source rows; non-arrays return empty result.
 * @param {string} columnName - Column to enumerate.
 * @param {{ search?: string, limit?: number, missingLabel?: string }} [options]
 * @returns {{ options: Array<{ token: string, label: string, count: number }>, allTokens: string[], total: number, hasMore: boolean }} `options` is the visible (post-`limit`) list; `allTokens` is the full token list for "select all" semantics.
 */
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

/** @private */
function parseNumericValue(value) {
  const parsed = toFiniteNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Apply one rule to `rows`. Returns the input unchanged when the rule has
 * no column or when its parameters do not resolve to a usable predicate
 * (e.g. numeric mode with non-parseable bounds).
 *
 * Note: for categorical mode, an active rule with neither include nor
 * exclude tokens returns `[]`: the user picked a column but no values,
 * so nothing matches. This is intentional UX; do not "fix" it without
 * checking call sites.
 *
 * @param {Array<Object<string, *>>} rows
 * @param {Object | null | undefined} rawFilter - Coerced via {@link normalizeFilterConfig} internally.
 * @param {string[]} [numericColumns=[]]
 * @returns {Array<Object<string, *>>} Filtered rows (a new array).
 */
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
  const excludeSet = new Set(filter.exclude.map(value => String(value)));

  if (includeSet.size === 0 && excludeSet.size === 0) return [];

  if (includeSet.size === 0) {
    return rows.filter(row => !excludeSet.has(toCategoryToken(row?.[filter.column])));
  }

  return rows.filter(row => {
    const token = toCategoryToken(row?.[filter.column]);
    if (!includeSet.has(token)) return false;
    if (excludeSet.has(token)) return false;
    return true;
  });
}
