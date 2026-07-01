/**
 * CHIVE chart action workflow.
 *
 * Delegated listener for chart action buttons: download-svg exports the chart's
 * SVG, add-panel snapshots the chart into the panel. Snapshot title/metadata come
 * from `chartSnapshotMetadata.js`.
 */

import { t } from '../../services/i18nService.js';
import { downloadSvgFromContainer } from '../../utils/svgExport.js';
import { addChartToPanel } from '../panelManager.js';
import { showError, showFeedback } from '../feedbackUI.js';
import { getChartSnapshotTitle, buildChartSnapshotMetadata } from './chartSnapshotMetadata.js';

let chartActionListenersReady = false;

/**
 * Internal workflow setup, called by `eventHandlers.js`.
 * Delegated listener for chart action buttons (download-svg, add-panel). Safe to
 * call more than once: the delegated listener registers only on the first call.
 */
export function setupChartActionListeners() {
	if (chartActionListenersReady) return;
	document.addEventListener('click', onChartActionClick);
	chartActionListenersReady = true;
}

/** @private */
function onChartActionClick(event) {
	const actionBtn = event.target.closest('[data-chart-action]');
	if (!actionBtn) return;
	handleChartAction(actionBtn);
}

/**
 * Handle chart action (download-svg or add-panel)
 * @private
 */
function handleChartAction(actionBtn) {
	const action = actionBtn.dataset.chartAction;
	const containerId = actionBtn.dataset.chartContainer;

	if (action === 'download-svg') {
		const filename = actionBtn.dataset.chartFilename || 'chart';
		const result = downloadSvgFromContainer(containerId, filename);
		if (!result.ok) {
			showError(t('chive-chart-download-error'));
		}
	} else if (action === 'add-panel') {
		const chartBlock = actionBtn.closest('.chart-block');
		const fallbackTitle = chartBlock?.querySelector('.chart-title')?.textContent?.trim()
			|| t('chive-card-charts');
		const titulo = getChartSnapshotTitle(containerId, fallbackTitle);
		const metadata = buildChartSnapshotMetadata(containerId);

		const result = addChartToPanel(containerId, titulo, metadata);
		if (!result.ok) {
			showError(t('chive-panel-add-error'));
		} else {
			showFeedback(t('chive-panel-add-success'));
		}
	}
}
