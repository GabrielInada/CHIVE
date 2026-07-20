/**
 * CHIVE dataset controller.
 *
 * Public owner for dataset-workspace initialization, dataset selection and
 * removal, file-input DOM binding, and workflow feedback routing. Upload,
 * join, and preset loading are delegated to controller-internal workflows.
 *
 * @typedef {import('../../types.js').Dataset} Dataset
 */

import { t } from '../../services/i18nService.js';
import { removeDataset, setActiveDataset, getAllDatasets } from '../../state/appState.js';
import { showError, showFeedback } from '../../ui/feedback.js';
import { FILE_IDS } from './domIds.js';
import { uploadDatasetFiles } from './workflows/uploadDataset.js';
import { createJoinedDataset } from './workflows/joinDatasets.js';
import { loadPresetDataset } from './workflows/loadPresetDataset.js';

// Confirmation function for user prompts, injectable for testing, defaults to window.confirm
let confirmFn = message => window.confirm(message);

/**
 * Initialize the dataset controller. Wires the confirmation function used for the
 * over-limit file-size prompt (injectable for testing; production callers can
 * omit it).
 *
 * Dataset-list renders are not wired here: every add/remove/select routes
 * through the data facade and emits `DATASET_ADDED` / `DATASET_REMOVED` /
 * `ACTIVE_DATASET`, which `app/renderCoordinator.js` subscribes to. There is no
 * change callback.
 *
 * @param {{ confirmCallback?: ((message: string) => boolean) | null }} [options] - `confirmCallback` defaults to `window.confirm`. Tolerates `null`/omitted.
 */
export function initDatasetController(options = {}) {
	const { confirmCallback = null } = options ?? {};
	confirmFn = confirmCallback || (message => window.confirm(message));
}

/**
 * Delegate files from the input or drop event to the upload workflow using
 * the controller's current injectable confirmation dependency.
 *
 * @param {FileList | File[] | null | undefined} files
 * @returns {Promise<void>}
 */
export async function handleFileUpload(files) {
	return uploadDatasetFiles(files, { confirm: confirmFn });
}

/**
 * Select a dataset as active. The facade emits `ACTIVE_DATASET`, which drives
 * the re-render.
 * @param {number} index - Dataset index
 */
export function selectDataset(index) {
	try {
		setActiveDataset(index);
	} catch (err) {
		showError(err.message);
	}
}

/**
 * Remove a dataset. The facade emits `DATASET_REMOVED`, which drives the
 * re-render.
 * @param {number} index - Dataset index
 */
export function removeDatasetByIndex(index) {
	try {
		removeDataset(index);
	} catch (err) {
		showError(err.message);
	}
}

/**
 * @returns {Dataset[]} Live reference to the datasets array. Do not mutate.
 */
export function getLoadedDatasets() {
	return getAllDatasets();
}

/**
 * Wire the file input + drop-zone listeners. Handles click-to-open,
 * keyboard activation (Enter/Space), drag hover styling, and drop
 * delegation into {@link handleFileUpload}. The input's `value` is
 * cleared after each upload so re-selecting the same file still fires.
 * Surfaces an error toast if either expected DOM element is missing.
 */
export function setupFileInputListeners() {
	const fileInput = document.getElementById(FILE_IDS.fileInput);
	const uploadZone = document.getElementById(FILE_IDS.uploadZone);

	if (fileInput) {
		fileInput.addEventListener('change', async event => {
			const target = event.target;
			if (!(target instanceof HTMLInputElement)) return;

			try {
				await handleFileUpload(target.files);
			} finally {
				// Allow selecting the same file again and still trigger `change`.
				target.value = '';
			}
		});
	} else {
		showError(t('chive-error-upload-input-missing'));
	}

	if (uploadZone) {
		// Click to open file picker
		uploadZone.addEventListener('click', () => {
			fileInput?.click();
		});

		// Drag and drop
		uploadZone.addEventListener('dragover', event => {
			event.preventDefault();
			event.stopPropagation();
			uploadZone.classList.add('hover');
		});

		uploadZone.addEventListener('dragleave', () => {
			uploadZone.classList.remove('hover');
		});

		uploadZone.addEventListener('drop', event => {
			event.preventDefault();
			event.stopPropagation();
			uploadZone.classList.remove('hover');
			handleFileUpload(event.dataTransfer.files);
		});
	} else {
		showError(t('chive-error-upload-zone-missing'));
	}
}

/**
 * Handle a join request from the dataset-list UI. Delegates to
 * {@link createJoinedDataset}; on success, activates the new dataset and shows a
 * success toast. Failures surface as error toasts with the translated message.
 * Re-render is driven by the `DATASET_ADDED` / `ACTIVE_DATASET` emits.
 *
 * @param {Object} spec - Forwarded to `createJoinedDataset`.
 */
export function handleJoinDatasetRequest(spec) {
	const result = createJoinedDataset(spec);
	if (!result?.ok) {
		showError(result?.message || t('chive-join-error-generic'));
		return;
	}

	selectDataset(result.index);
	showFeedback(t('chive-join-success', [result.datasetName]));
}

/**
 * Delegate a preset request to the controller-internal workflow. Dataset
 * selection stays on this public controller and is threaded into the workflow
 * to avoid a circular dependency.
 *
 * @param {import('../../types.js').PresetDescriptor & { nameKey: string, rows: number }} preset
 * @returns {Promise<void>}
 */
export async function handlePresetDatasetRequest(preset) {
	return loadPresetDataset(preset, { selectDataset });
}

export { createJoinedDataset } from './workflows/joinDatasets.js';
