/**
 * Top-level dataset workspace view.
 *
 * Composes the active dataset's tabs, preview, statistics, chart rendering,
 * column controls, and global-filter dialog. File-list and empty-state flows
 * are owned by sibling views; chart tooltip filter actions are feature-owned
 * under filters/.
 *
 * @typedef {import('../../types.js').Dataset} Dataset
 * @typedef {import('../../types.js').ColumnSpec} ColumnSpec
 * @typedef {import('../../types.js').ChartConfig} ChartConfig
 */

import { t, getLocale, translateType } from '../../services/i18nService.js';
import { mergeChartConfigWithDefaults } from '../../config/chartDefaults.js';
import { PREVIEW_DEFAULT_ROWS, PREVIEW_MIN_ROWS } from '../../config/limits.js';
import { getNumericColumns } from '../../domain/datasets/columns.js';

import { renderCharts } from './views/chartsView.js';
import { updateTabs } from './views/tabsView.js';
import { renderTablePreview } from './views/tablePreviewView.js';
import { renderStats, renderCategoricalStats } from './views/statsView.js';
import { renderColumnControlsDOM } from './views/columnControlsView.js';
import { VIEW_IDS, FILE_IDS, BADGE_IDS, WORKSPACE_ACTION_IDS } from './domIds.js';
import { openGlobalFilterDialog } from './dialogs/globalFilterDialog.js';
import { createGlobalFilterActions } from './filters/globalFilterActions.js';
import {
  applyGlobalFilterRules,
  resolveGlobalFilterForColumns,
} from '../../domain/filters/globalFilter.js';

/**
 * Render the main data-interface for the active dataset: tabs, table
 * preview, stats, charts, and the column-controls strip. Wires the
 * global-filter action handlers passed down into the chart layer's
 * tooltip actions.
 *
 * Side effects: enables the "Next" button, toggles the upload zone to
 * its loaded state, and updates the file-meta tooltip.
 *
 * @param {Array<Object<string, *>>} rows
 * @param {ColumnSpec[]} columns
 * @param {string} fileName
 * @param {string} fileSize
 * @param {number} [previewRows=PREVIEW_DEFAULT_ROWS] - Number of rows to show in the table preview.
 * @param {(rows: number) => void} [onPreviewRowsChange]
 * @param {string[] | null} [selectedColumns] - Visible columns; defaults to all when null.
 * @param {(names: string[]) => void} [onColumnSelectionChange]
 * @param {Partial<ChartConfig> | null} [chartConfig] - Merged with defaults before rendering.
 * @param {(partial: Partial<ChartConfig>) => void} [onChartConfigChange]
 * @returns {void}
 */
export function renderDatasetWorkspace(
  rows,
  columns,
  fileName,
  fileSize,
  previewRows = PREVIEW_DEFAULT_ROWS,
  onPreviewRowsChange = null,
  selectedColumns = null,
  onColumnSelectionChange = null,
  chartConfig = null,
  onChartConfigChange = null
) {
  document.getElementById(VIEW_IDS.columnPanel).style.display = 'block';
  document.getElementById(VIEW_IDS.resultTabs).style.display = 'flex';
  document.getElementById(VIEW_IDS.emptyState).style.display = 'none';
  document.getElementById(VIEW_IDS.dataState).style.display = 'flex';

  const columnNames = columns.map(column => column.name);
  const selectedNames = new Set(Array.isArray(selectedColumns) ? selectedColumns : columnNames);
  const visibleColumns = columns.filter(column => selectedNames.has(column.name));
  const visibleNumericColumns = getNumericColumns(visibleColumns);

  const config = mergeChartConfigWithDefaults(chartConfig);

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

  const allColumnNames = columns.map(column => column.name);
  const safeGlobalFilter = resolveGlobalFilterForColumns(config.globalFilter, allColumnNames);
  const filteredRows = applyGlobalFilterRules(rows, safeGlobalFilter, numericNames);

  const globalFilterActions = createGlobalFilterActions({
    globalFilter: config.globalFilter,
    safeGlobalFilter,
    allColumnNames,
    onChartConfigChange,
  });

  updateTabs(config.activeTab, onChartConfigChange, config, {
    triggerState: {
      hasDataset: true,
      globalFilter: safeGlobalFilter,
      filteredCount: filteredRows.length,
      totalCount: rows.length,
    },
    onGlobalFilterOpen: async () => {
      if (!onChartConfigChange) return;
      const result = await openGlobalFilterDialog({
        rows,
        allColumns: allColumnNames,
        numericColumns: numericNames,
        initialFilter: safeGlobalFilter,
        translate: t,
      });
      if (!result) return;
      if (result.action === 'apply' || result.action === 'clear') {
        onChartConfigChange({ globalFilter: result.filter });
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
  renderStats(filteredRows, visibleColumns);
  renderCategoricalStats(filteredRows, visibleColumns);
  renderCharts(config, rows, visibleColumns, visibleNumericColumns, globalFilterActions);

  document.getElementById(WORKSPACE_ACTION_IDS.advanceButton).disabled = false;
  const devNotice = document.getElementById('dev-warning');
  if (devNotice) devNotice.style.display = 'block';
  document.getElementById(FILE_IDS.uploadZone).classList.add('loaded');
  document.querySelector('.upload-icon').textContent = '✓';
  document.querySelector('.upload-text-main').textContent = t('chive-upload-loaded-main');
  document.querySelector('.upload-text-sub').textContent = t('chive-upload-loaded-sub');
  document.getElementById(FILE_IDS.fileSummary).title =
    `${fileName} · ${rows.length.toLocaleString(getLocale())} rows · ${columns.length} columns · ${fileSize}`;
}
