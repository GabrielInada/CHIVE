/**
 * Dataset-workspace global-filter action wiring.
 *
 * Wraps pure domain filter transformations with the feature's chart-config
 * callback contract. Chart tooltip handlers stay nullable when no writer is
 * available, while lookup functions are always present.
 *
 * Tooltip actions edit categorical include and exclude sets, which a rule on
 * a numeric column ignores: the filter always applies it as a numeric rule.
 * So a numeric column is not filterable from a tooltip. `canFilterColumn`
 * tells the tooltip not to offer the actions, the handlers ignore it, and the
 * lookups report no state for it, even when a stored rule carries leftover
 * tokens.
 */

import {
  createSingleCategoryGlobalFilter,
  excludeTokenFromFilter,
  getTokenFilterState,
  isShowOnlyThisRedundant,
  mergeIncludeTokenIntoFilter,
  removeExcludeTokenFromFilter,
  removeIncludeTokenFromFilter,
} from '../../../domain/filters/globalFilter.js';

/**
 * @param {Object} args
 * @param {*} args.globalFilter - The stored filter the actions edit.
 * @param {*} args.safeGlobalFilter - The filter that applies, which the lookups read.
 * @param {string[]} args.allColumnNames - Every dataset column, hidden ones included.
 * @param {string[]} [args.numericColumnNames=[]] - Columns the dataset types as numbers.
 * @param {((partial: Object) => void) | null} [args.onDatasetConfigChange]
 */
export function createGlobalFilterActions({
  globalFilter,
  safeGlobalFilter,
  allColumnNames,
  numericColumnNames = [],
  onDatasetConfigChange,
}) {
  const canFilterColumn = column => typeof column === 'string'
    && allColumnNames.includes(column)
    && !numericColumnNames.includes(column);

  const action = transform => (onDatasetConfigChange
    ? (column, token) => {
      if (typeof token !== 'string' || !canFilterColumn(column)) return;
      onDatasetConfigChange({ globalFilter: transform(column, token) });
    }
    : null);

  const lookupTokenFilterState = (column, token) => (canFilterColumn(column)
    ? getTokenFilterState(safeGlobalFilter, column, token)
    : null);
  const lookupShowOnlyThisRedundant = (column, token) => canFilterColumn(column)
    && isShowOnlyThisRedundant(safeGlobalFilter, column, token);

  return {
    onAddToGlobalFilter: action((column, token) => mergeIncludeTokenIntoFilter(globalFilter, column, token)),
    onFocusGlobalFilter: action((column, token) => createSingleCategoryGlobalFilter(column, token)),
    onExcludeGlobalFilter: action((column, token) => excludeTokenFromFilter(globalFilter, column, token)),
    onRemoveFromGlobalFilter: action((column, token) => removeIncludeTokenFromFilter(globalFilter, column, token)),
    onBringBackGlobalFilter: action((column, token) => removeExcludeTokenFromFilter(globalFilter, column, token)),
    getTokenFilterState: lookupTokenFilterState,
    isShowOnlyThisRedundant: lookupShowOnlyThisRedundant,
    canFilterColumn,
  };
}
