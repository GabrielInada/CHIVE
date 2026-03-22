export function createDataStateFacade({ appState, emitStateChange }) {
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
		emitStateChange('activeDataset', index);
	}

	function addDataset(dataset) {
		if (!dataset || !Array.isArray(dataset.dados)) {
			throw new Error('Invalid dataset: must have "dados" array');
		}
		appState.data.datasets.push(dataset);
		const index = appState.data.datasets.length - 1;
		if (appState.data.activeIndex === -1) {
			appState.data.activeIndex = index;
		}
		emitStateChange('datasetAdded', { index, dataset });
		return index;
	}

	function removeDataset(index) {
		if (index < 0 || index >= appState.data.datasets.length) {
			throw new Error(`Invalid dataset index: ${index}`);
		}
		appState.data.datasets.splice(index, 1);

		if (appState.data.activeIndex >= index) {
			appState.data.activeIndex = Math.max(-1, appState.data.activeIndex - 1);
		}

		// Clear panel snapshots tied to removed dataset context.
		appState.panel.charts = [];
		appState.panel.slots = {};

		emitStateChange('datasetRemoved', index);
	}

	function updateActiveDatasetConfig(updates) {
		const dataset = getActiveDataset();
		if (!dataset) return;

		dataset.configGraficos = {
			...dataset.configGraficos,
			...updates,
		};
		emitStateChange('configUpdated', updates);
	}

	function updateActiveDatasetColumns(columnNames) {
		const dataset = getActiveDataset();
		if (!dataset) return;

		dataset.colunasSelecionadas = columnNames;
		emitStateChange('columnsUpdated', columnNames);
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
	};
}
