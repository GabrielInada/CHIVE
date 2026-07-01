/**
 * CHIVE dataset action workflow.
 *
 * Delegated listeners for dataset row buttons (rendered in resultsView): select a
 * dataset or remove it by index.
 */

import { selectDataset, removeDatasetByIndex } from '../fileManager.js';

/**
 * Internal workflow setup, called by `eventHandlers.js`.
 * Delegated listeners for dataset select/remove buttons.
 */
export function setupDatasetListeners() {
	// Delegated listeners for dataset buttons (rendered in resultsView)
	document.addEventListener('click', event => {
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
	});
}
