/**
 * Dataset workspace empty-state view.
 *
 * Restores the initial upload surface and clears every dataset and chart
 * presentation surface when no datasets remain.
 */

import { t } from '../../../services/i18nService.js';
import { CHART_CONTAINERS } from '../../../charts/workspaceDomIds.js';
import { clearChartContainer } from '../../../charts/shared/containerLifecycle.js';
import { updateTabs } from './tabsView.js';
import { VIEW_IDS, FILE_IDS, BADGE_IDS, WORKSPACE_ACTION_IDS } from '../domIds.js';

/**
 * Render the "no dataset loaded" empty state. Hides the data interface,
 * clears every chart container, and resets the upload-zone UI to its
 * initial state.
 *
 * @returns {void}
 */
export function renderEmptyState() {
  const els = {
    fileInfo: document.getElementById(VIEW_IDS.fileInfo),
    columnPanel: document.getElementById(VIEW_IDS.columnPanel),
    emptyState: document.getElementById(VIEW_IDS.emptyState),
    dataState: document.getElementById(VIEW_IDS.dataState),
    resultTabs: document.getElementById(VIEW_IDS.resultTabs),
    tableContainer: document.getElementById(VIEW_IDS.tableContainer),
    statsContainer: document.getElementById(VIEW_IDS.statsContainer),
    categoricalStatsContainer: document.getElementById(VIEW_IDS.categoricalStatsContainer),
    categoricalStatsCard: document.getElementById(VIEW_IDS.categoricalStatsCard),
    chartsBadge: document.getElementById(BADGE_IDS.charts),
    advanceButton: document.getElementById(WORKSPACE_ACTION_IDS.advanceButton),
  };

  // Only update elements that exist (not null)
  if (els.fileInfo) els.fileInfo.hidden = false;
  if (els.columnPanel) els.columnPanel.hidden = true;
  if (els.emptyState) els.emptyState.hidden = false;
  if (els.dataState) els.dataState.hidden = true;
  if (els.resultTabs) els.resultTabs.hidden = false;
  updateTabs('preview', null, null, {
    triggerState: {
      hasDataset: false,
      globalFilter: null,
      filteredCount: 0,
      totalCount: 0,
    },
  });
  if (els.tableContainer) els.tableContainer.replaceChildren();
  if (els.statsContainer) els.statsContainer.replaceChildren();
  if (els.categoricalStatsContainer) els.categoricalStatsContainer.replaceChildren();
  if (els.categoricalStatsCard) els.categoricalStatsCard.hidden = true;
  for (const containerId of Object.values(CHART_CONTAINERS)) {
    clearChartContainer(document.getElementById(containerId));
  }
  if (els.chartsBadge) els.chartsBadge.textContent = '0';
  if (els.advanceButton) els.advanceButton.disabled = true;

  const uploadZone = document.getElementById(FILE_IDS.uploadZone);
  if (uploadZone) uploadZone.classList.remove('loaded');

  const uploadIcon = document.querySelector('.upload-icon');
  if (uploadIcon) uploadIcon.textContent = '⬆';

  const uploadTextMain = document.querySelector('.upload-text-main');
  if (uploadTextMain) uploadTextMain.textContent = t('chive-upload-main');

  const uploadTextSub = document.querySelector('.upload-text-sub');
  // innerHTML: translation contains <br>/<strong>; source is i18n JSON, not user input.
  if (uploadTextSub) uploadTextSub.innerHTML = t('chive-upload-sub');
}
