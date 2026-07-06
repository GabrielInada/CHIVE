/**
 * CHIVE dataset action workflow.
 *
 * Delegated listeners for dataset row buttons (rendered in datasetWorkspaceView):
 * select a dataset or remove it by index.
 */

import { selectDataset, removeDatasetByIndex } from '../fileManager.js';

let datasetListenersReady = false;

/**
 * Internal workflow setup, called by `eventHandlers.js`.
 * Delegated listeners for dataset select/remove buttons. Safe to call more than
 * once: the delegated listener registers only on the first call.
 */
export function setupDatasetListeners() {
	if (datasetListenersReady) return;
	// Delegated listeners for dataset buttons (rendered in datasetWorkspaceView)
	document.addEventListener('click', onDatasetClick);
	datasetListenersReady = true;
}

/** @private */
function onDatasetClick(event) {
	// Select dataset
	const selectBtn = event.target.closest('[data-dataset-select]');
	if (selectBtn) {
		event.preventDefault();
		const index = parseInt(selectBtn.dataset.datasetSelect, 10);
		selectDataset(index);
		return;
	}

	// Remove dataset
	const removeBtn = event.target.closest('[data-dataset-remove]');
	if (removeBtn) {
		event.preventDefault();
		const index = parseInt(removeBtn.dataset.datasetRemove, 10);
		removeDatasetByIndex(index);
		return;
	}
}
