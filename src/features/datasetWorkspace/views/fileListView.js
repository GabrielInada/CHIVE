/**
 * Dataset file-list orchestration view.
 *
 * Owns search and pagination state, selected-dataset metadata, and the Join
 * and Preset tool flows. Item rendering stays in fileListItems.js so the flow
 * and DOM-item renderer retain separate test seams.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 */

import { t, getLocale } from '../../../services/i18nService.js';
import { renderFileListDOM } from './fileListItems.js';
import { openJoinBuilderDialog } from '../dialogs/joinBuilderView.js';
import { openPresetDatasetsDialog } from '../dialogs/presetDatasetsView.js';
import { VIEW_IDS, FILE_IDS } from '../domIds.js';

const FILE_LIST_PAGE_SIZE = 15;
let fileListQuery = '';
let fileListVisibleCount = FILE_LIST_PAGE_SIZE;

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
  const fileInfo = document.getElementById(VIEW_IDS.fileInfo);
  const summary = document.getElementById(FILE_IDS.fileSummary);
  const list = document.getElementById(FILE_IDS.fileListContent);

  fileInfo.hidden = false;
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
    selectedMeta.hidden = false;
    selectedMeta.title = selectedMeta.textContent;
  } else {
    selectedMeta.textContent = '';
    selectedMeta.hidden = true;
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
    await onCreateJoin?.(spec);
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
