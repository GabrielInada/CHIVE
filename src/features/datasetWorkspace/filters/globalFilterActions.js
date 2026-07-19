/**
 * Dataset-workspace global-filter action wiring.
 *
 * Wraps pure domain filter transformations with the feature's chart-config
 * callback contract. Chart tooltip handlers stay nullable when no writer is
 * available, while lookup functions are always present.
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

export function createGlobalFilterActions({
  globalFilter,
  safeGlobalFilter,
  allColumnNames,
  onChartConfigChange,
}) {
  const handleAddToGlobalFilter = onChartConfigChange
    ? (column, token) => {
      if (typeof column !== 'string' || typeof token !== 'string') return;
      if (!allColumnNames.includes(column)) return;
      const merged = mergeIncludeTokenIntoFilter(globalFilter, column, token);
      onChartConfigChange({ globalFilter: merged });
    }
    : null;

  const handleShowOnlyThis = onChartConfigChange
    ? (column, token) => {
      if (typeof column !== 'string' || typeof token !== 'string') return;
      if (!allColumnNames.includes(column)) return;
      onChartConfigChange({ globalFilter: createSingleCategoryGlobalFilter(column, token) });
    }
    : null;

  const handleExcludeFromGlobalFilter = onChartConfigChange
    ? (column, token) => {
      if (typeof column !== 'string' || typeof token !== 'string') return;
      if (!allColumnNames.includes(column)) return;
      const next = excludeTokenFromFilter(globalFilter, column, token);
      onChartConfigChange({ globalFilter: next });
    }
    : null;

  const handleRemoveFromGlobalFilter = onChartConfigChange
    ? (column, token) => {
      if (typeof column !== 'string' || typeof token !== 'string') return;
      if (!allColumnNames.includes(column)) return;
      const next = removeIncludeTokenFromFilter(globalFilter, column, token);
      onChartConfigChange({ globalFilter: next });
    }
    : null;

  const handleBringBackFromGlobalFilter = onChartConfigChange
    ? (column, token) => {
      if (typeof column !== 'string' || typeof token !== 'string') return;
      if (!allColumnNames.includes(column)) return;
      const next = removeExcludeTokenFromFilter(globalFilter, column, token);
      onChartConfigChange({ globalFilter: next });
    }
    : null;

  const lookupTokenFilterState = (column, token) => getTokenFilterState(safeGlobalFilter, column, token);
  const lookupShowOnlyThisRedundant = (column, token) => isShowOnlyThisRedundant(safeGlobalFilter, column, token);

  return {
    onAddToGlobalFilter: handleAddToGlobalFilter,
    onFocusGlobalFilter: handleShowOnlyThis,
    onExcludeGlobalFilter: handleExcludeFromGlobalFilter,
    onRemoveFromGlobalFilter: handleRemoveFromGlobalFilter,
    onBringBackGlobalFilter: handleBringBackFromGlobalFilter,
    getTokenFilterState: lookupTokenFilterState,
    isShowOnlyThisRedundant: lookupShowOnlyThisRedundant,
  };
}
