/**
 * Top-level dataset workspace view.
 *
 * Composes the active dataset's tabs, preview, statistics, chart rendering,
 * column controls, and global-filter dialog from the shown dataset, which the
 * render coordinator derives once per render pass. File-list and empty-state
 * flows are owned by sibling views; chart tooltip filter actions are built by
 * the charts view.
 *
 * @typedef {import('../../types.js').ShownDataset} ShownDataset
 * @typedef {import('../../types.js').ChartConfig} ChartConfig
 */

import { t, getLocale, translateType } from '../../services/i18nService.js';
import { PREVIEW_DEFAULT_ROWS, PREVIEW_MIN_ROWS } from '../../config/limits.js';

import { renderCharts } from './views/chartsView.js';
import { updateTabs } from './views/tabsView.js';
import { renderTablePreview } from './views/tablePreviewView.js';
import { renderNumericStats, renderCategoricalStats } from './views/statsView.js';
import { renderColumnControlsDOM } from './views/columnControlsView.js';
import { VIEW_IDS, FILE_IDS, BADGE_IDS, WORKSPACE_ACTION_IDS } from './domIds.js';
import { openGlobalFilterDialog } from './dialogs/globalFilterDialog.js';

/**
 * Render the main data-interface for the active dataset: tabs, table
 * preview, stats, charts, and the column-controls strip. The preview, the
 * stats and the charts all read the shown dataset's rows and visible columns.
 *
 * Side effects: enables the "Next" button, toggles the upload zone to
 * its loaded state, and updates the file-meta tooltip.
 *
 * @param {ShownDataset} shown
 * @param {Object} [options]
 * @param {number} [options.previewRows=PREVIEW_DEFAULT_ROWS] - Number of rows to show in the table preview.
 * @param {((rows: number) => void) | null} [options.onPreviewRowsChange]
 * @param {((names: string[]) => void) | null} [options.onColumnSelectionChange]
 * @param {((partial: Partial<ChartConfig>) => void) | null} [options.onDatasetConfigChange] - Receives tab, global filter and tooltip filter changes.
 * @returns {void}
 */
export function renderDatasetWorkspace(shown, {
  previewRows = PREVIEW_DEFAULT_ROWS,
  onPreviewRowsChange = null,
  onColumnSelectionChange = null,
  onDatasetConfigChange = null,
} = {}) {
  const { dataset, rows: filteredRows, filter: safeGlobalFilter, visibleColumns } = shown;
  const { rows, columns, chartConfig: config } = dataset;

  document.getElementById(VIEW_IDS.columnPanel).hidden = false;
  document.getElementById(VIEW_IDS.resultTabs).hidden = false;
  document.getElementById(VIEW_IDS.emptyState).hidden = true;
  document.getElementById(VIEW_IDS.dataState).hidden = false;

  const columnNames = columns.map(column => column.name);
  const selectedNames = new Set(visibleColumns.map(column => column.name));

  // Detect active filter
  const numericNames = columns.filter(c => c.type === 'number').map(c => c.name);
  const textNames = columns.filter(c => c.type === 'text').map(c => c.name);
  const selectedArray = [...selectedNames];
  const activeFilter =
    selectedArray.length === columnNames.length ? 'all'
      : selectedArray.length === numericNames.length && selectedArray.every(n => numericNames.includes(n)) ? 'numeric'
        : selectedArray.length === textNames.length && selectedArray.every(n => textNames.includes(n)) ? 'text'
          : null;

  // Render buttons outside the scroll container
  const actionsContainer = document.getElementById('column-actions-bar');
  const columnsList = document.getElementById('column-list-content');

  renderColumnControlsDOM({
    actionsContainer,
    columnsList,
    columns,
    selectedNames,
    activeFilter,
    columnNames,
    numericNames,
    textNames,
    translate: t,
    translateType,
    onColumnSelectionChange,
  });

  updateTabs(config.activeTab, onDatasetConfigChange, {
    triggerState: {
      hasDataset: true,
      globalFilter: safeGlobalFilter,
      filteredCount: filteredRows.length,
      totalCount: rows.length,
    },
    onGlobalFilterOpen: async () => {
      if (!onDatasetConfigChange) return;
      const result = await openGlobalFilterDialog({
        rows,
        allColumns: columnNames,
        numericColumns: numericNames,
        initialFilter: safeGlobalFilter,
        translate: t,
      });
      if (!result) return;
      if (result.action === 'apply' || result.action === 'clear') {
        onDatasetConfigChange({ globalFilter: result.filter });
      }
    },
  });

  const rowLimit = Number(previewRows) > 0
    ? Number(previewRows)
    : PREVIEW_DEFAULT_ROWS;
  const rowSelector = document.getElementById('select-preview-rows');
  if (rowSelector) {
    rowSelector.value = String(rowLimit);
    rowSelector.onchange = event => {
      if (!onPreviewRowsChange) return;
      const nextRows = Number(event.target.value);
      if (!Number.isFinite(nextRows) || nextRows < PREVIEW_MIN_ROWS) return;
      onPreviewRowsChange(nextRows);
    };
  }
  document.getElementById(BADGE_IDS.rows).textContent = t(
    'chive-badge-preview',
    filteredRows.length.toLocaleString(getLocale()),
    Math.min(rowLimit, filteredRows.length),
    visibleColumns.length,
    columns.length
  );

  renderTablePreview(filteredRows, visibleColumns, rowLimit);
  renderNumericStats(filteredRows, visibleColumns);
  renderCategoricalStats(filteredRows, visibleColumns);
  renderCharts(shown, onDatasetConfigChange);

  document.getElementById(WORKSPACE_ACTION_IDS.advanceButton).disabled = false;
  document.getElementById(FILE_IDS.uploadZone).classList.add('loaded');
  document.querySelector('.upload-icon').textContent = '✓';
  document.querySelector('.upload-text-main').textContent = t('chive-upload-loaded-main');
  document.querySelector('.upload-text-sub').textContent = t('chive-upload-loaded-sub');
  document.getElementById(FILE_IDS.fileSummary).title =
    `${dataset.name} · ${rows.length.toLocaleString(getLocale())} rows · ${columns.length} columns · ${dataset.sizeLabel}`;
}
