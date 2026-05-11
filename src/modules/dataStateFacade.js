import { STATE_EVENTS } from './stateEvents.js';

const CHART_TYPES = ['bar', 'scatter', 'pie', 'bubble', 'network', 'treemap'];

let datasetIdCounter = 0;
function generateDatasetId() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	datasetIdCounter += 1;
	return `dataset-${Date.now()}-${datasetIdCounter}`;
}

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
		emitStateChange(STATE_EVENTS.DATASET_ADDED, { index, dataset });
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

		emitStateChange(STATE_EVENTS.DATASET_REMOVED, index);
	}

	function updateActiveDatasetConfig(updates) {
		const dataset = getActiveDataset();
		if (!dataset) return;

		dataset.configGraficos = {
			...dataset.configGraficos,
			...updates,
		};
		emitStateChange(STATE_EVENTS.CONFIG_UPDATED, updates);
	}

	function updateActiveDatasetColumns(columnNames) {
		const dataset = getActiveDataset();
		if (!dataset) return;

		dataset.colunasSelecionadas = columnNames;
		emitStateChange(STATE_EVENTS.COLUMNS_UPDATED, columnNames);
	}

	// Non-emitting config write for normalize-on-read paths (e.g. applying
	// defaults during render). Emitting here would re-enter refreshView via
	// the CONFIG_UPDATED subscription and loop.
	function normalizeActiveDatasetConfig(normalizer) {
		const dataset = getActiveDataset();
		if (!dataset) return;
		dataset.configGraficos = normalizer(dataset.configGraficos);
	}

	// Radio-style activation: enable exactly one chart type (or none if null).
	// Backs the single-chart-at-a-time viz tab UX. The optional `activatedOverrides`
	// are merged into the activated chart's config in the same mutation, so per-chart
	// toggle handlers can pass defaults (e.g. category) without firing a second event.
	function setActiveChartType(chartType, activatedOverrides = null) {
		const dataset = getActiveDataset();
		if (!dataset) return;
		if (chartType !== null && !CHART_TYPES.includes(chartType)) return;

		const current = dataset.configGraficos || {};
		const next = { ...current };
		CHART_TYPES.forEach(type => {
			const previous = current[type] || {};
			next[type] = { ...previous, enabled: type === chartType };
		});
		if (chartType && activatedOverrides && typeof activatedOverrides === 'object') {
			next[chartType] = { ...next[chartType], ...activatedOverrides };
		}
		dataset.configGraficos = next;
		emitStateChange(STATE_EVENTS.CONFIG_UPDATED, { activeChartType: chartType });
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
		setActiveChartType,
	};
}
