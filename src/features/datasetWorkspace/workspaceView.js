/**
 * Top-level dataset workspace view.
 *
 * Orchestrates the right-hand pane: tabs (preview/stats/charts), the file
 * list + tools (search, join, preset), the column-controls strip, and the
 * chart-rendering flow. Most rendering is delegated to the sibling view
 * modules in this package; this file wires them together and owns the
 * global-filter action handlers that the chart layer dispatches.
 *
 * @typedef {import('../../types.js').Dataset} Dataset
 * @typedef {import('../../types.js').ColumnSpec} ColumnSpec
 * @typedef {import('../../types.js').ChartConfig} ChartConfig
 */

import { t, getLocale, translateType } from '../../services/i18nService.js';
import { mergeChartConfigWithDefaults } from '../../config/chartDefaults.js';
import { CHART_CONTAINERS } from '../../config/elementIds.js';
import { getNumericColumns } from '../../utils/columnHelpers.js';
import { clearChartContainer } from '../../utils/chartContainerLifecycle.js';

import { renderCharts } from './views/chartsView.js';
import { updateTabs } from './views/tabsView.js';
import { renderTablePreview } from './views/tablePreviewView.js';
import { renderStats, renderCategoricalStats } from './views/statsView.js';
import { renderFileListDOM } from './views/fileListView.js';
import { renderColumnControlsDOM } from './views/columnControlsView.js';
import { openJoinBuilderDialog } from './dialogs/joinBuilderView.js';
import { openPresetDatasetsDialog } from './dialogs/presetDatasetsView.js';
import { openGlobalFilterDialog } from './dialogs/globalFilterDialog.js';
import {
  applyGlobalFilterRules,
  createSingleCategoryGlobalFilter,
  excludeTokenFromFilter,
  getTokenFilterState,
  isShowOnlyThisRedundant,
  mergeIncludeTokenIntoFilter,
  removeExcludeTokenFromFilter,
  removeIncludeTokenFromFilter,
  resolveGlobalFilterForColumns,
} from '../../utils/globalFilter.js';

const FILE_LIST_PAGE_SIZE = 15;
let fileListQuery = '';
let fileListVisibleCount = FILE_LIST_PAGE_SIZE;

/**
 * Show the top-banner error message. Prefixes with a warning glyph.
 *
 * @param {string} message
 * @returns {void}
 */
export function showErrorMessage(message) {
  const errorElement = document.getElementById('error-message');
  errorElement.textContent = '⚠ ' + message;
  errorElement.style.display = 'block';
}

/**
 * Hide the top-banner error message.
 *
 * @returns {void}
 */
export function hideErrorMessage() {
  document.getElementById('error-message').style.display = 'none';
}

/**
 * Render the dataset file list with search, "show more/less" pagination,
 * the active-dataset metadata row, and the Join/Preset tool buttons.
 *
 * Filter query and visible-count state are module-local, re-rendering
 * resets visible-count when the query changes, but preserves it across
 * paginations of the same query.
 *
 * @param {Dataset[]} datasets
 * @param {number} activeIndex - `-1` when no dataset is active.
 * @param {(index: number) => void} onSelect
 * @param {(index: number) => void} onRemove
 * @param {(spec: Object) => void} [onCreateJoin] - Fired with the join-builder dialog's resolved spec.
 * @param {(presetId: string) => void} [onLoadPreset] - Fired with the chosen preset id.
 * @returns {void}
 */
export function renderFileList(datasets, activeIndex, onSelect, onRemove, onCreateJoin, onLoadPreset) {
  const fileInfo = document.getElementById('file-info');
  const summary = document.getElementById('file-summary-text');
  const list = document.getElementById('file-list-content');

  fileInfo.style.display = 'block';
  const stickyHeaderId = 'files-top-fixed';
  let stickyHeader = document.getElementById(stickyHeaderId);
  if (!stickyHeader) {
    stickyHeader = document.createElement('div');
    stickyHeader.id = stickyHeaderId;
    stickyHeader.className = 'files-top-fixed';
    fileInfo.insertBefore(stickyHeader, summary);
  }

  if (summary.parentElement !== stickyHeader) {
    stickyHeader.appendChild(summary);
  }

  summary.textContent = t('chive-files-loaded', datasets.length);

  const activeDataset = activeIndex >= 0 && activeIndex < datasets.length ? datasets[activeIndex] : null;
  const selectedMetaId = 'file-selected-meta';
  let selectedMeta = document.getElementById(selectedMetaId);
  if (!selectedMeta) {
    selectedMeta = document.createElement('div');
    selectedMeta.id = selectedMetaId;
    selectedMeta.className = 'files-selected-meta';
    stickyHeader.appendChild(selectedMeta);
  } else if (selectedMeta.parentElement !== stickyHeader) {
    stickyHeader.appendChild(selectedMeta);
  }

  if (activeDataset) {
    const metaText = t(
      'chive-file-meta',
      activeDataset.rows.length.toLocaleString(getLocale()),
      activeDataset.columns.length,
      activeDataset.sizeLabel
    );
    selectedMeta.textContent = `${activeDataset.name} · ${metaText}`;
    selectedMeta.style.display = 'block';
    selectedMeta.title = selectedMeta.textContent;
  } else {
    selectedMeta.textContent = '';
    selectedMeta.style.display = 'none';
    selectedMeta.removeAttribute('title');
  }

  const toolsId = 'files-tools';
  let tools = document.getElementById(toolsId);
  if (!tools) {
    tools = document.createElement('div');
    tools.id = toolsId;
    tools.className = 'files-tools';
    stickyHeader.appendChild(tools);
  } else if (tools.parentElement !== stickyHeader) {
    stickyHeader.appendChild(tools);
  }

  tools.replaceChildren();
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'files-filter-input';
  searchInput.id = 'files-filter-input';
  searchInput.placeholder = t('chive-files-search-placeholder');
  searchInput.value = fileListQuery;
  searchInput.setAttribute('aria-label', t('chive-files-search-placeholder'));
  tools.appendChild(searchInput);

  const filterStatus = document.createElement('div');
  filterStatus.className = 'files-filter-status';
  tools.appendChild(filterStatus);

  const paginationId = 'files-pagination';
  let pagination = document.getElementById(paginationId);
  if (!pagination) {
    pagination = document.createElement('div');
    pagination.id = paginationId;
    pagination.className = 'files-pagination';
    list.insertAdjacentElement('afterend', pagination);
  }

  const renderList = () => {
    const renderResult = renderFileListDOM({
      list,
      datasets,
      activeIndex,
      translate: t,
      getLocale,
      onSelect,
      onRemove,
      filter: fileListQuery,
      visibleLimit: fileListVisibleCount,
    });

    filterStatus.textContent = t('chive-files-filter-status', renderResult.filtered, renderResult.total);
    pagination.replaceChildren();

    if (renderResult.filtered > FILE_LIST_PAGE_SIZE) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'btn-secondary files-pagination-btn';

      if (renderResult.hasMore) {
        toggle.textContent = t('chive-files-show-more', renderResult.filtered - renderResult.rendered);
        toggle.addEventListener('click', () => {
          fileListVisibleCount += FILE_LIST_PAGE_SIZE;
          renderList();
        });
      } else {
        toggle.textContent = t('chive-files-show-less');
        toggle.addEventListener('click', () => {
          fileListVisibleCount = FILE_LIST_PAGE_SIZE;
          renderList();
        });
      }

      pagination.appendChild(toggle);
    }
  };

  searchInput.addEventListener('input', () => {
    fileListQuery = searchInput.value;
    fileListVisibleCount = FILE_LIST_PAGE_SIZE;
    renderList();
  });

  fileListVisibleCount = Math.max(FILE_LIST_PAGE_SIZE, fileListVisibleCount);
  renderList();

  const joinActionsId = 'join-files-actions';
  let joinActions = document.getElementById(joinActionsId);
  if (!joinActions) {
    joinActions = document.createElement('div');
    joinActions.id = joinActionsId;
    joinActions.className = 'join-files-actions';
    list.insertAdjacentElement('afterend', joinActions);
  }

  joinActions.replaceChildren();
  const joinButton = document.createElement('button');
  joinButton.type = 'button';
  joinButton.className = 'btn-secondary btn-join-files';
  joinButton.id = 'btn-join-files';
  joinButton.textContent = t('chive-btn-join-files');
  joinButton.disabled = datasets.length < 2;
  joinButton.addEventListener('click', async () => {
    const spec = await openJoinBuilderDialog({
      datasets,
      translate: t,
    });
    if (!spec) return;
    onCreateJoin?.(spec);
  });
  joinActions.appendChild(joinButton);

  const presetButton = document.createElement('button');
  presetButton.type = 'button';
  presetButton.className = 'btn-secondary btn-preset-datasets';
  presetButton.id = 'btn-preset-datasets';
  presetButton.textContent = t('chive-btn-preset-datasets');
  presetButton.addEventListener('click', async () => {
    const selected = await openPresetDatasetsDialog({ translate: t });
    if (!selected) return;
    onLoadPreset?.(selected);
  });
  joinActions.appendChild(presetButton);
}

/**
 * Render the "no dataset loaded" empty state. Hides the data interface,
 * clears every chart container, and resets the upload-zone UI to its
 * initial state.
 *
 * @returns {void}
 */
export function renderEmptyState() {
  const els = {
    'file-info': document.getElementById('file-info'),
    'columns-panel': document.getElementById('columns-panel'),
    'empty-state': document.getElementById('empty-state'),
    'data-state': document.getElementById('data-state'),
    'result-tabs': document.getElementById('result-tabs'),
    'table-container': document.getElementById('table-container'),
    'container-stats': document.getElementById('container-stats'),
    'container-cat-stats': document.getElementById('container-cat-stats'),
    'card-cat-stats': document.getElementById('card-cat-stats'),
    'badge-charts': document.getElementById('badge-charts'),
    'btn-advance': document.getElementById('btn-advance'),
  };

  // Only update elements that exist (not null)
  if (els['file-info']) els['file-info'].style.display = 'block';
  if (els['columns-panel']) els['columns-panel'].style.display = 'none';
  if (els['empty-state']) els['empty-state'].style.display = 'flex';
  if (els['data-state']) els['data-state'].style.display = 'none';
  if (els['result-tabs']) els['result-tabs'].style.display = 'flex';
  updateTabs('preview', null, null, {
    triggerState: {
      hasDataset: false,
      globalFilter: null,
      filteredCount: 0,
      totalCount: 0,
    },
  });
  if (els['table-container']) els['table-container'].replaceChildren();
  if (els['container-stats']) els['container-stats'].replaceChildren();
  if (els['container-cat-stats']) els['container-cat-stats'].replaceChildren();
  if (els['card-cat-stats']) els['card-cat-stats'].style.display = 'none';
  for (const containerId of Object.values(CHART_CONTAINERS)) {
    clearChartContainer(document.getElementById(containerId));
  }
  if (els['badge-charts']) els['badge-charts'].textContent = '0';
  if (els['btn-advance']) els['btn-advance'].disabled = true;

  const devNotice = document.getElementById('dev-warning');
  if (devNotice) devNotice.style.display = 'none';

  const uploadZone = document.getElementById('upload-zone');
  if (uploadZone) uploadZone.classList.remove('loaded');
  
  const uploadIcon = document.querySelector('.upload-icon');
  if (uploadIcon) uploadIcon.textContent = '⬆';
  
  const uploadTextMain = document.querySelector('.upload-text-main');
  if (uploadTextMain) uploadTextMain.textContent = t('chive-upload-main');
  
  const uploadTextSub = document.querySelector('.upload-text-sub');
  // innerHTML: translation contains <br>/<strong>; source is i18n JSON, not user input.
  if (uploadTextSub) uploadTextSub.innerHTML = t('chive-upload-sub');
}

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
 * @param {number} [previewRows=10] - Number of rows to show in the table preview.
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
  previewRows = 10,
  onPreviewRowsChange = null,
  selectedColumns = null,
  onColumnSelectionChange = null,
  chartConfig = null,
  onChartConfigChange = null
) {
  document.getElementById('columns-panel').style.display = 'block';
  document.getElementById('result-tabs').style.display = 'flex';
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('data-state').style.display = 'flex';

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

  const handleAddToGlobalFilter = onChartConfigChange
    ? (column, token) => {
      if (typeof column !== 'string' || typeof token !== 'string') return;
      if (!allColumnNames.includes(column)) return;
      const merged = mergeIncludeTokenIntoFilter(config.globalFilter, column, token);
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
      const next = excludeTokenFromFilter(config.globalFilter, column, token);
      onChartConfigChange({ globalFilter: next });
    }
    : null;

  const handleRemoveFromGlobalFilter = onChartConfigChange
    ? (column, token) => {
      if (typeof column !== 'string' || typeof token !== 'string') return;
      if (!allColumnNames.includes(column)) return;
      const next = removeIncludeTokenFromFilter(config.globalFilter, column, token);
      onChartConfigChange({ globalFilter: next });
    }
    : null;

  const handleBringBackFromGlobalFilter = onChartConfigChange
    ? (column, token) => {
      if (typeof column !== 'string' || typeof token !== 'string') return;
      if (!allColumnNames.includes(column)) return;
      const next = removeExcludeTokenFromFilter(config.globalFilter, column, token);
      onChartConfigChange({ globalFilter: next });
    }
    : null;

  const lookupTokenFilterState = (column, token) => getTokenFilterState(safeGlobalFilter, column, token);
  const lookupShowOnlyThisRedundant = (column, token) => isShowOnlyThisRedundant(safeGlobalFilter, column, token);

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

  const rowLimit = Number(previewRows) > 0 ? Number(previewRows) : 10;
  const rowSelector = document.getElementById('select-preview-rows');
  if (rowSelector) {
    rowSelector.value = String(rowLimit);
    rowSelector.onchange = event => {
      if (!onPreviewRowsChange) return;
      const nextRows = Number(event.target.value);
      if (!Number.isFinite(nextRows) || nextRows < 1) return;
      onPreviewRowsChange(nextRows);
    };
  }
  document.getElementById('badge-rows').textContent = t(
    'chive-badge-preview',
    filteredRows.length.toLocaleString(getLocale()),
    Math.min(rowLimit, filteredRows.length),
    visibleColumns.length,
    columns.length
  );

  renderTablePreview(filteredRows, visibleColumns, rowLimit);
  renderStats(filteredRows, visibleColumns);
  renderCategoricalStats(filteredRows, visibleColumns);
  renderCharts(config, rows, visibleColumns, visibleNumericColumns, {
    onAddToGlobalFilter: handleAddToGlobalFilter,
    onFocusGlobalFilter: handleShowOnlyThis,
    onExcludeGlobalFilter: handleExcludeFromGlobalFilter,
    onRemoveFromGlobalFilter: handleRemoveFromGlobalFilter,
    onBringBackGlobalFilter: handleBringBackFromGlobalFilter,
    getTokenFilterState: lookupTokenFilterState,
    isShowOnlyThisRedundant: lookupShowOnlyThisRedundant,
  });

  document.getElementById('btn-advance').disabled = false;
  const devNotice = document.getElementById('dev-warning');
  if (devNotice) devNotice.style.display = 'block';
  document.getElementById('upload-zone').classList.add('loaded');
  document.querySelector('.upload-icon').textContent = '✓';
  document.querySelector('.upload-text-main').textContent = t('chive-upload-loaded-main');
  document.querySelector('.upload-text-sub').textContent = t('chive-upload-loaded-sub');
  document.getElementById('file-summary-text').title =
    `${fileName} · ${rows.length.toLocaleString(getLocale())} rows · ${columns.length} columns · ${fileSize}`;
}
