/**
 * CHIVE Application State Management
 * 
 * Centralized single source of truth for all application state.
 * All mutations go through this module to ensure consistency and enable tracking.
 * 
 * State Shape:
 * {
 *   data: {
 *     datasets: Array<Dataset>,
 *     activeIndex: number
 *   },
 *   panel: {
 *     charts: Array<ChartSnapshot>,
 *     slots: Object<slotId, chartId>,
 *     layout: string,
 *     nextChartId: number
 *   },
 *   ui: {
 *     sidebarMode: 'dados' | 'viz' | 'panel',
 *     previewRows: number,
 *     expandedCharts: Object<chartName, boolean>
 *   }
 * }
 */

const appState = {
	data: {
		datasets: [],
		activeIndex: -1,
	},
	panel: {
		charts: [],
		slots: {},
		layout: 'layout-2col',
		nextChartId: 0,
	},
	ui: {
		sidebarMode: 'dados',
		previewRows: 10,
		expandedCharts: {
			bar: false,
			scatter: false,
		},
	},
};

/**
 * Get a deep clone of the entire state
 * @returns {Object} Current application state
 */
export function getState() {
	return JSON.parse(JSON.stringify(appState));
}

/**
 * Get active dataset
 * @returns {Object|null} Currently selected dataset or null
 */
export function getActiveDataset() {
	if (appState.data.activeIndex === -1 || !appState.data.datasets[appState.data.activeIndex]) {
		return null;
	}
	return appState.data.datasets[appState.data.activeIndex];
}

/**
 * Get all loaded datasets
 * @returns {Array} All datasets
 */
export function getAllDatasets() {
	return appState.data.datasets;
}

/**
 * Get active dataset index
 * @returns {number} Index of active dataset, or -1 if none
 */
export function getActiveDatasetIndex() {
	return appState.data.activeIndex;
}

/**
 * Set active dataset by index
 * @param {number} index - Dataset index
 * @throws {Error} If index is invalid
 */
export function setActiveDataset(index) {
	if (index < -1 || index >= appState.data.datasets.length) {
		throw new Error(`Invalid dataset index: ${index}`);
	}
	appState.data.activeIndex = index;
	emitStateChange('activeDataset', index);
}

/**
 * Add a new dataset to the collection
 * @param {Object} dataset - Dataset object with data, colunas, etc.
 * @returns {number} Index of newly added dataset
 */
export function addDataset(dataset) {
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

/**
 * Remove dataset by index
 * @param {number} index - Dataset index
 * @throws {Error} If index is invalid
 */
export function removeDataset(index) {
	if (index < 0 || index >= appState.data.datasets.length) {
		throw new Error(`Invalid dataset index: ${index}`);
	}
	appState.data.datasets.splice(index, 1);
	
	// Adjust active index if needed
	if (appState.data.activeIndex >= index) {
		appState.data.activeIndex = Math.max(-1, appState.data.activeIndex - 1);
	}
	
	// Clear panel when dataset removed (snapshots tied to this data)
	appState.panel.charts = [];
	appState.panel.slots = {};
	
	emitStateChange('datasetRemoved', index);
}

/**
 * Update active dataset config
 * @param {Object} updates - Config updates to merge
 */
export function updateActiveDatasetConfig(updates) {
	const dataset = getActiveDataset();
	if (!dataset) return;
	
	dataset.configGraficos = {
		...dataset.configGraficos,
		...updates,
	};
	emitStateChange('configUpdated', updates);
}

/**
 * Update active dataset column selection
 * @param {Array<string>} columnNames - Selected column names
 */
export function updateActiveDatasetColumns(columnNames) {
	const dataset = getActiveDataset();
	if (!dataset) return;
	
	dataset.colunasSelecionadas = columnNames;
	emitStateChange('columnsUpdated', columnNames);
}

/**
 * Get panel charts
 * @returns {Array} Panel chart snapshots
 */
export function getPanelCharts() {
	return appState.panel.charts;
}

/**
 * Add chart snapshot to panel
 * @param {Object} chartSnapshot - { id, nome, svgMarkup, createdAt }
 * @returns {number} Chart ID
 */
export function addChartSnapshot(chartSnapshot) {
	const id = appState.panel.nextChartId++;
	const numericId = id;
	const snapshot = {
		id: numericId,
		nome: sanitizeChartName(chartSnapshot.nome),
		svgMarkup: chartSnapshot.svgMarkup,
		createdAt: chartSnapshot.createdAt || new Date().toISOString(),
	};
	appState.panel.charts.push(snapshot);
	emitStateChange('chartAdded', { id: numericId, snapshot });
	return numericId;
}

function normalizePanelChartId(chartId) {
	const normalized = Number(chartId);
	return Number.isFinite(normalized) ? normalized : null;
}

/**
 * Remove chart from panel
 * @param {number} chartId - Chart ID
 */
export function removeChartSnapshot(chartId) {
	const normalizedId = normalizePanelChartId(chartId);
	if (normalizedId === null) return;

	appState.panel.charts = appState.panel.charts.filter(c => c.id !== normalizedId);
	// Remove from slots
	Object.keys(appState.panel.slots).forEach(slotId => {
		if (appState.panel.slots[slotId] === normalizedId) {
			delete appState.panel.slots[slotId];
		}
	});
	emitStateChange('chartRemoved', normalizedId);
}

/**
 * Get chart snapshot by ID
 * @param {number} chartId - Chart ID
 * @returns {Object|null} Chart snapshot or null
 */
export function getChartSnapshot(chartId) {
	const normalizedId = normalizePanelChartId(chartId);
	if (normalizedId === null) return null;
	return appState.panel.charts.find(c => c.id === normalizedId) || null;
}

/**
 * Get panel slots configuration
 * @returns {Object} Slots mapping { slotId: chartId }
 */
export function getPanelSlots() {
	return appState.panel.slots;
}

/**
 * Assign chart to slot
 * @param {string} slotId - Slot identifier
 * @param {number} chartId - Chart ID (or null to clear)
 */
export function assignChartToSlot(slotId, chartId) {
	if (chartId === null) {
		delete appState.panel.slots[slotId];
	} else {
		const normalizedId = normalizePanelChartId(chartId);
		if (normalizedId === null) {
			throw new Error(`Chart ${chartId} not found`);
		}

		const chart = getChartSnapshot(normalizedId);
		if (!chart) {
			throw new Error(`Chart ${chartId} not found`);
		}
		appState.panel.slots[slotId] = normalizedId;
	}
	emitStateChange('slotAssigned', { slotId, chartId });
}

/**
 * Get current panel layout
 * @returns {string} Layout ID
 */
export function getPanelLayout() {
	return appState.panel.layout;
}

/**
 * Set panel layout
 * @param {string} layoutId - Layout identifier
 */
export function setPanelLayout(layoutId) {
	appState.panel.layout = layoutId;
	emitStateChange('layoutChanged', layoutId);
}

/**
 * Get UI sidebar mode
 * @returns {string} 'dados' | 'viz' | 'panel'
 */
export function getSidebarMode() {
	return appState.ui.sidebarMode;
}

/**
 * Set UI sidebar mode
 * @param {string} mode - 'dados' | 'viz' | 'panel'
 */
export function setSidebarMode(mode) {
	if (!['dados', 'viz', 'panel'].includes(mode)) {
		throw new Error(`Invalid sidebar mode: ${mode}`);
	}
	if (appState.ui.sidebarMode === mode) {
		return;
	}
	appState.ui.sidebarMode = mode;
	emitStateChange('sidebarModeChanged', mode);
}

/**
 * Get expanded charts state
 * @returns {Object} Expanded state for each chart
 */
export function getExpandedCharts() {
	return appState.ui.expandedCharts;
}

/**
 * Toggle chart expansion
 * @param {string} chartName - Chart name ('bar' | 'scatter')
 * @param {boolean} expanded - Expanded state
 */
export function setChartExpanded(chartName, expanded) {
	appState.ui.expandedCharts[chartName] = expanded;
	emitStateChange('chartExpandedChanged', { chartName, expanded });
}

/**
 * Get preview rows limit
 * @returns {number} Number of rows to preview
 */
export function getPreviewRows() {
	return appState.ui.previewRows;
}

/**
 * Set preview rows limit
 * @param {number} rows - Number of rows
 */
export function setPreviewRows(rows) {
	if (rows < 1) throw new Error('Preview rows must be >= 1');
	appState.ui.previewRows = rows;
	emitStateChange('previewRowsChanged', rows);
}

/**
 * Sanitize chart name for safe text display
 * @param {string} name - Raw name
 * @returns {string} Sanitized name
 */
export function sanitizeChartName(name) {
	return String(name).slice(0, 100).trim();
}

/**
 * Clear all panel data
 */
export function clearPanel() {
	appState.panel.charts = [];
	appState.panel.slots = {};
	appState.panel.nextChartId = 0;
	emitStateChange('panelCleared');
}

/**
 * Validate panel slots (remove invalid slot assignments)
 */
export function validatePanelSlots() {
	const validChartIds = new Set(appState.panel.charts.map(c => c.id));
	Object.keys(appState.panel.slots).forEach(slotId => {
		const chartId = appState.panel.slots[slotId];
		if (!validChartIds.has(chartId)) {
			delete appState.panel.slots[slotId];
		}
	});
}

/**
 * Subscribe to state changes
 * @param {string} eventType - Event type (or '*' for all)
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
const stateListeners = {};
export function onStateChange(eventType, callback) {
	if (!stateListeners[eventType]) {
		stateListeners[eventType] = [];
	}
	stateListeners[eventType].push(callback);
	
	// Return unsubscribe function
	return () => {
		const index = stateListeners[eventType].indexOf(callback);
		if (index > -1) {
			stateListeners[eventType].splice(index, 1);
		}
	};
}

/**
 * Emit state change event
 * @private
 * @param {string} eventType - Event type
 * @param {*} data - Change data
 */
function emitStateChange(eventType, data) {
	// Notify specific listeners
	if (stateListeners[eventType]) {
		stateListeners[eventType].forEach(cb => {
			try {
				cb(data);
			} catch (err) {
				window.dispatchEvent(new CustomEvent('chive-internal-error', {
					detail: {
						type: 'state-listener-error',
						eventType,
						message: String(err?.message || err),
					},
				}));
			}
		});
	}
	
	// Notify wildcard listeners
	if (stateListeners['*']) {
		stateListeners['*'].forEach(cb => {
			try {
				cb({ type: eventType, data });
			} catch (err) {
				window.dispatchEvent(new CustomEvent('chive-internal-error', {
					detail: {
						type: 'state-wildcard-listener-error',
						eventType,
						message: String(err?.message || err),
					},
				}));
			}
		});
	}
	
	// Dispatch custom event for external listeners
	window.dispatchEvent(new CustomEvent('chive-state-changed', {
		detail: { type: eventType, data },
	}));
}

/**
 * Reset state to initial values (for testing)
 */
export function resetState() {
	appState.data.datasets = [];
	appState.data.activeIndex = -1;
	appState.panel.charts = [];
	appState.panel.slots = {};
	appState.panel.layout = 'layout-2col';
	appState.panel.nextChartId = 0;
	appState.ui.sidebarMode = 'dados';
	appState.ui.previewRows = 10;
	appState.ui.expandedCharts = { bar: false, scatter: false };
	emitStateChange('stateReset');
}

/**
 * Export window globals for backwards compatibility
 * These are currently updated by stateSync module
 */
export function exposeGlobals() {
	window.datasetsCarregados = appState.data.datasets;
	window.datasetAtivo = getActiveDataset();
	window.dadosCarregados = getActiveDataset()?.dados || null;
	window.colunasDetectadas = getActiveDataset()?.colunas || null;
	window.colunasSelecionadasAtivas = getActiveDataset()?.colunasSelecionadas || null;
	window.chartsPainel = appState.panel.charts;
	window.slotsPainel = appState.panel.slots;
	window.layoutPainelAtual = appState.panel.layout;
}
