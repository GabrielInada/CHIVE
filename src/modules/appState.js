import { emitStateChange, onStateChange, STATE_EVENTS } from './stateEvents.js';
import { createPanelBlock as buildPanelBlock } from './panel/blockStateHelpers.js';
import { createDataStateFacade } from './dataStateFacade.js';
import { createUiStateFacade } from './uiStateFacade.js';
import { createPanelStateFacade } from './panelStateFacade.js';

export { onStateChange, STATE_EVENTS };

/**
 * CHIVE Application State Management
 *
 * Centralized single source of truth for all application state.
 * All mutations go through this module to ensure consistency and enable tracking.
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
		blocks: [],
		nextBlockId: 1,
		nextChartId: 0,
	},
	ui: {
		sidebarMode: 'dados',
		previewRows: 10,
		expandedCharts: {
			bar: false,
			scatter: false,
			network: false,
			pie: false,
			bubble: false,
		},
	},
};

const PANEL_BLOCK_LIMIT = 4;
const PANEL_BLOCK_MIN_HEIGHT = 220;
const PANEL_BLOCK_MAX_HEIGHT = 760;

function createPanelBlock(templateId = 'layout-2col') {
	const block = buildPanelBlock(appState.panel.nextBlockId, templateId);
	appState.panel.nextBlockId += 1;
	return block;
}

function ensureDefaultPanelBlock() {
	if (!Array.isArray(appState.panel.blocks)) {
		appState.panel.blocks = [];
	}
	if (appState.panel.blocks.length === 0) {
		appState.panel.blocks.push(createPanelBlock('layout-2col'));
	}
}

/**
 * Sanitize chart name for safe text display.
 * @param {string} name
 * @returns {string}
 */
export function sanitizeChartName(name) {
	return String(name).slice(0, 100).trim();
}

const dataState = createDataStateFacade({ appState, emitStateChange });
const uiState = createUiStateFacade({ appState, emitStateChange });
const panelState = createPanelStateFacade({
	appState,
	emitStateChange,
	createPanelBlock,
	ensureDefaultPanelBlock,
	sanitizeChartName,
	panelBlockLimit: PANEL_BLOCK_LIMIT,
	panelBlockMinHeight: PANEL_BLOCK_MIN_HEIGHT,
	panelBlockMaxHeight: PANEL_BLOCK_MAX_HEIGHT,
});

/**
 * Get a deep clone of the entire state.
 * @returns {Object}
 */
export function getState() {
	return JSON.parse(JSON.stringify(appState));
}

/**
 * Data domain exports
 */
export function getActiveDataset() {
	return dataState.getActiveDataset();
}

export function getAllDatasets() {
	return dataState.getAllDatasets();
}

export function getActiveDatasetIndex() {
	return dataState.getActiveDatasetIndex();
}

export function setActiveDataset(index) {
	return dataState.setActiveDataset(index);
}

export function addDataset(dataset) {
	return dataState.addDataset(dataset);
}

export function removeDataset(index) {
	return dataState.removeDataset(index);
}

export function updateActiveDatasetConfig(updates) {
	return dataState.updateActiveDatasetConfig(updates);
}

export function updateActiveDatasetColumns(columnNames) {
	return dataState.updateActiveDatasetColumns(columnNames);
}

export function normalizeActiveDatasetConfig(normalizer) {
	return dataState.normalizeActiveDatasetConfig(normalizer);
}

/**
 * Panel domain exports
 */
export function getPanelCharts() {
	return panelState.getPanelCharts();
}

export function addChartSnapshot(chartSnapshot) {
	return panelState.addChartSnapshot(chartSnapshot);
}

export function removeChartSnapshot(chartId) {
	return panelState.removeChartSnapshot(chartId);
}

export function getChartSnapshot(chartId) {
	return panelState.getChartSnapshot(chartId);
}

export function getPanelSlots() {
	return panelState.getPanelSlots();
}

export function getPanelBlocks() {
	return panelState.getPanelBlocks();
}

export function assignChartToSlot(slotId, chartId) {
	return panelState.assignChartToSlot(slotId, chartId);
}

export function getPanelLayout() {
	return panelState.getPanelLayout();
}

export function setPanelLayout(layoutId) {
	return panelState.setPanelLayout(layoutId);
}

export function clearPanel() {
	return panelState.clearPanel();
}

export function validatePanelSlots() {
	return panelState.validatePanelSlots();
}

export function addPanelBlock(templateId = 'layout-2col') {
	return panelState.addPanelBlock(templateId);
}

export function removePanelBlock(blockId) {
	return panelState.removePanelBlock(blockId);
}

export function movePanelBlock(blockId, targetIndex) {
	return panelState.movePanelBlock(blockId, targetIndex);
}

export function updatePanelBlockProportions(blockId, partialProportions) {
	return panelState.updatePanelBlockProportions(blockId, partialProportions);
}

export function updatePanelBlockHeight(blockId, heightPx) {
	return panelState.updatePanelBlockHeight(blockId, heightPx);
}

export function updatePanelBlockBorder(blockId, options = {}) {
	return panelState.updatePanelBlockBorder(blockId, options);
}

export function setPanelBlockTemplate(blockId, templateId) {
	return panelState.setPanelBlockTemplate(blockId, templateId);
}

export function assignChartToPanelBlockSlot(blockId, slotId, chartId) {
	return panelState.assignChartToPanelBlockSlot(blockId, slotId, chartId);
}

export function migrateLegacyPanelState() {
	return panelState.migrateLegacyPanelState();
}

/**
 * UI domain exports
 */
export function getSidebarMode() {
	return uiState.getSidebarMode();
}

export function setSidebarMode(mode) {
	return uiState.setSidebarMode(mode);
}

export function getExpandedCharts() {
	return uiState.getExpandedCharts();
}

export function setChartExpanded(chartName, expanded) {
	return uiState.setChartExpanded(chartName, expanded);
}

export function getPreviewRows() {
	return uiState.getPreviewRows();
}

export function setPreviewRows(rows) {
	return uiState.setPreviewRows(rows);
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
	appState.panel.nextBlockId = 1;
	appState.panel.blocks = [createPanelBlock('layout-2col')];
	appState.panel.nextChartId = 0;
	appState.ui.sidebarMode = 'dados';
	appState.ui.previewRows = 10;
	appState.ui.expandedCharts = { bar: false, scatter: false, network: false, pie: false, bubble: false };
	emitStateChange(STATE_EVENTS.STATE_RESET);
}

/**
 * Export window globals for backwards compatibility.
 * These are currently updated by stateSync module.
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
