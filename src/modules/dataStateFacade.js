import { STATE_EVENTS } from './stateEvents.js';

let datasetIdCounter = 0;
function generateDatasetId() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	datasetIdCounter += 1;
	return `dataset-${Date.now()}-${datasetIdCounter}`;
}

export function createDataStateFacade({ appState, emitStateChange }) {
	// Per-dataset dirty/removed tracking so persistenceService can write only
	// changed records instead of clearing + rewriting every dataset on every
	// save. Mutators below mark dataset ids as they change. The autosave
	// subscriber drains and resets these sets after each successful IDB write
	// (and on STATE_HYDRATED, to discard marks set during hydration).
	const dirtyDatasetIds = new Set();
	const removedDatasetIds = new Set();

	function markDatasetDirty(id) {
		if (!id) return;
		dirtyDatasetIds.add(id);
		// A pending removal is cancelled if the same id is dirtied again.
		removedDatasetIds.delete(id);
	}

	function markDatasetRemoved(id) {
		if (!id) return;
		removedDatasetIds.add(id);
		// A dataset added then removed within one debounce window was never
		// persisted — drop the dirty mark so we don't try to put() a record
		// that no longer exists in state.
		dirtyDatasetIds.delete(id);
	}

	function getDirtyDatasetIds() {
		return {
			dirty: Array.from(dirtyDatasetIds),
			removed: Array.from(removedDatasetIds),
		};
	}

	function clearDirtyDatasetIds() {
		dirtyDatasetIds.clear();
		removedDatasetIds.clear();
	}

	function getActiveDataset() {
		if (appState.data.activeIndex === -1 || !appState.data.datasets[appState.data.activeIndex]) {
			return null;
		}
		return appState.data.datasets[appState.data.activeIndex];
	}

	function getAllDatasets() {
		return appState.data.datasets;
	}

	function getActiveDatasetIndex() {
		return appState.data.activeIndex;
	}

	function setActiveDataset(index) {
		if (index < -1 || index >= appState.data.datasets.length) {
			throw new Error(`Invalid dataset index: ${index}`);
		}
		appState.data.activeIndex = index;
		emitStateChange(STATE_EVENTS.ACTIVE_DATASET, index);
	}

	function addDataset(dataset) {
		if (!dataset || !Array.isArray(dataset.dados)) {
			throw new Error('Invalid dataset: must have "dados" array');
		}
		// Stamp a stable id so persistence can address datasets across reloads.
		// Tests in environments without crypto.randomUUID fall back to a counter.
		if (!dataset.id) {
			dataset.id = generateDatasetId();
		}
		appState.data.datasets.push(dataset);
		const index = appState.data.datasets.length - 1;
		if (appState.data.activeIndex === -1) {
			appState.data.activeIndex = index;
		}
		markDatasetDirty(dataset.id);
		emitStateChange(STATE_EVENTS.DATASET_ADDED, { index, dataset });
		return index;
	}

	function removeDataset(index) {
		if (index < 0 || index >= appState.data.datasets.length) {
			throw new Error(`Invalid dataset index: ${index}`);
		}
		// Capture the id before splice so we can mark it removed for IDB.
		const removedId = appState.data.datasets[index]?.id;
		appState.data.datasets.splice(index, 1);

		if (appState.data.activeIndex >= index) {
			appState.data.activeIndex = Math.max(-1, appState.data.activeIndex - 1);
		}

		// Clear panel snapshots tied to removed dataset context.
		appState.panel.charts = [];
		appState.panel.slots = {};

		markDatasetRemoved(removedId);
		emitStateChange(STATE_EVENTS.DATASET_REMOVED, index);
	}

	function updateActiveDatasetConfig(updates) {
		const dataset = getActiveDataset();
		if (!dataset) return;

		dataset.configGraficos = {
			...dataset.configGraficos,
			...updates,
		};
		markDatasetDirty(dataset.id);
		emitStateChange(STATE_EVENTS.CONFIG_UPDATED, updates);
	}

	function updateActiveDatasetColumns(columnNames) {
		const dataset = getActiveDataset();
		if (!dataset) return;

		dataset.colunasSelecionadas = columnNames;
		markDatasetDirty(dataset.id);
		emitStateChange(STATE_EVENTS.COLUMNS_UPDATED, columnNames);
	}

	// Non-emitting config write for normalize-on-read paths (e.g. applying
	// defaults during render). Emitting here would re-enter refreshView via
	// the CONFIG_UPDATED subscription and loop.
	function normalizeActiveDatasetConfig(normalizer) {
		const dataset = getActiveDataset();
		if (!dataset) return;
		dataset.configGraficos = normalizer(dataset.configGraficos);
		markDatasetDirty(dataset.id);
	}

	return {
		getActiveDataset,
		getAllDatasets,
		getActiveDatasetIndex,
		setActiveDataset,
		addDataset,
		removeDataset,
		updateActiveDatasetConfig,
		updateActiveDatasetColumns,
		normalizeActiveDatasetConfig,
		getDirtyDatasetIds,
		clearDirtyDatasetIds,
	};
}
