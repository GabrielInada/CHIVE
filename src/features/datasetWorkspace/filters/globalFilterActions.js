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
  onDatasetConfigChange,
}) {
  const handleAddToGlobalFilter = onDatasetConfigChange
    ? (column, token) => {
      if (typeof column !== 'string' || typeof token !== 'string') return;
      if (!allColumnNames.includes(column)) return;
      const merged = mergeIncludeTokenIntoFilter(globalFilter, column, token);
      onDatasetConfigChange({ globalFilter: merged });
    }
    : null;

  const handleShowOnlyThis = onDatasetConfigChange
    ? (column, token) => {
      if (typeof column !== 'string' || typeof token !== 'string') return;
      if (!allColumnNames.includes(column)) return;
      onDatasetConfigChange({ globalFilter: createSingleCategoryGlobalFilter(column, token) });
    }
    : null;

  const handleExcludeFromGlobalFilter = onDatasetConfigChange
    ? (column, token) => {
      if (typeof column !== 'string' || typeof token !== 'string') return;
      if (!allColumnNames.includes(column)) return;
      const next = excludeTokenFromFilter(globalFilter, column, token);
      onDatasetConfigChange({ globalFilter: next });
    }
    : null;

  const handleRemoveFromGlobalFilter = onDatasetConfigChange
    ? (column, token) => {
      if (typeof column !== 'string' || typeof token !== 'string') return;
      if (!allColumnNames.includes(column)) return;
      const next = removeIncludeTokenFromFilter(globalFilter, column, token);
      onDatasetConfigChange({ globalFilter: next });
    }
    : null;

  const handleBringBackFromGlobalFilter = onDatasetConfigChange
    ? (column, token) => {
      if (typeof column !== 'string' || typeof token !== 'string') return;
      if (!allColumnNames.includes(column)) return;
      const next = removeExcludeTokenFromFilter(globalFilter, column, token);
      onDatasetConfigChange({ globalFilter: next });
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
