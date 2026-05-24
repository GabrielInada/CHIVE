import { emitStateChange, onStateChange, STATE_EVENTS } from './stateEvents.js';
import { createPanelBlock as buildPanelBlock } from '../panelSubsystem/blockStateHelpers.js';
import { createDataStateFacade } from './dataStateFacade.js';
import { createUiStateFacade } from './uiStateFacade.js';
import { createPanelStateFacade } from './panelStateFacade.js';

export { onStateChange, STATE_EVENTS };

/**
 * CHIVE application state — single source of truth.
 *
 * The private `appState` object below is never exported. All reads go
 * through `get*` functions; all writes go through the three domain facades
 * (data, ui, panel) whose methods are re-exported as the convenience API.
 *
 * Note on the two `createPanelBlock` symbols in this file:
 *   - The import from `./panel/blockStateHelpers.js` is aliased to
 *     `buildPanelBlock` — a pure constructor that takes an explicit id.
 *   - The local `createPanelBlock` below is a closure that calls
 *     `buildPanelBlock` AND increments `appState.panel.nextBlockId`. This
 *     is the one passed into the panel facade. Do not conflate the two.
 *
 * @typedef {import('../../types.js').AppState} AppState
 * @typedef {import('../../types.js').Dataset} Dataset
 * @typedef {import('../../types.js').ChartSnapshot} ChartSnapshot
 * @typedef {import('../../types.js').PanelBlock} PanelBlock
 * @typedef {import('../../types.js').PanelTemplateId} PanelTemplateId
 * @typedef {import('../../types.js').PanelBlockProportions} PanelBlockProportions
 * @typedef {import('../../types.js').SidebarMode} SidebarMode
 * @typedef {import('../../types.js').ChartTypeKey} ChartTypeKey
 *
 * @see ARCHITECTURE.md
 * @see CONTRIBUTING.md "Architecture invariants — do not break"
 */

const appState = {
	data: {
		datasets: [],
		activeIndex: -1,
	},
	panel: {
		charts: [],
		slots: {},
		layout: 'template-2col',
		blocks: [],
		nextBlockId: 1,
		nextChartId: 0,
	},
	ui: {
		sidebarMode: 'data',
		previewRows: 10,
	},
};

const PANEL_BLOCK_LIMIT = 4;
const PANEL_BLOCK_MIN_HEIGHT = 220;
const PANEL_BLOCK_MAX_HEIGHT = 760;

/**
 * Build a new panel block AND advance the monotonic id counter. The id is
 * stamped into the block via `buildPanelBlock` (the pure helper); the
 * counter increment is the side effect that lives here.
 *
 * @private
 * @param {PanelTemplateId} [templateId='template-2col']
 * @returns {PanelBlock}
 */
function createPanelBlock(templateId = 'template-2col') {
	const block = buildPanelBlock(appState.panel.nextBlockId, templateId);
	appState.panel.nextBlockId += 1;
	return block;
}

/**
 * Insert a default `template-2col` block when `panel.blocks` is empty (or has
 * been replaced by a non-array). Called from every panel-facade method that
 * touches `blocks` — this is why several "getter" methods on the facade
 * have a mutation as a side effect.
 *
 * @private
 */
function ensureDefaultPanelBlock() {
	if (!Array.isArray(appState.panel.blocks)) {
		appState.panel.blocks = [];
	}
	if (appState.panel.blocks.length === 0) {
		appState.panel.blocks.push(createPanelBlock('template-2col'));
	}
}

/**
 * Sanitize a chart name for safe text display: coerce to string, slice to
 * 100 chars, and trim whitespace.
 *
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
 * Read a deep clone of the entire state. Safe to mutate without affecting
 * the real state — contrast with the live-reference getters
 * ({@link getAllDatasets}, {@link getPanelCharts}, {@link getPanelBlocks}).
 *
 * @returns {AppState} Deep clone.
 */
export function getState() {
	return JSON.parse(JSON.stringify(appState));
}

// ─── Data domain ────────────────────────────────────────────────────────

/**
 * @returns {Dataset | null} Live reference to the active dataset, or `null` when none is selected. Do not mutate.
 */
export function getActiveDataset() {
	return dataState.getActiveDataset();
}

/**
 * @returns {Dataset[]} Live reference to the datasets array. Do not mutate.
 */
export function getAllDatasets() {
	return dataState.getAllDatasets();
}

/**
 * Switch the active dataset.
 *
 * @param {number} index - Zero-based index, or `-1` to deselect.
 * @throws {Error} When `index < -1` or `index >= datasets.length`.
 * @fires STATE_EVENTS.ACTIVE_DATASET
 */
export function setActiveDataset(index) {
	return dataState.setActiveDataset(index);
}

/**
 * Append a dataset and auto-activate it when no dataset was active. Stamps
 * a stable id when missing.
 *
 * @param {Dataset} dataset - Must have a `rows` array.
 * @returns {number} Index of the new dataset.
 * @throws {Error} When `dataset` is missing or `dataset.rows` is not an array.
 * @fires STATE_EVENTS.DATASET_ADDED
 */
export function addDataset(dataset) {
	return dataState.addDataset(dataset);
}

/**
 * Remove a dataset. Also clears `panel.charts` and the legacy `panel.slots`
 * map because snapshots may reference columns/rows that no longer exist.
 *
 * @param {number} index
 * @throws {Error} When `index` is out of range.
 * @fires STATE_EVENTS.DATASET_REMOVED
 */
export function removeDataset(index) {
	return dataState.removeDataset(index);
}

/**
 * Shallow-merge `updates` into the active dataset's `chartConfig`.
 * No-op when no dataset is active.
 *
 * @param {Object} updates
 * @fires STATE_EVENTS.CONFIG_UPDATED
 */
export function updateActiveDatasetConfig(updates) {
	return dataState.updateActiveDatasetConfig(updates);
}

/**
 * Replace the active dataset's selected-column list. No-op when no dataset
 * is active.
 *
 * @param {string[]} columnNames
 * @fires STATE_EVENTS.COLUMNS_UPDATED
 */
export function updateActiveDatasetColumns(columnNames) {
	return dataState.updateActiveDatasetColumns(columnNames);
}

/**
 * Apply a normalizer to the active dataset's `chartConfig`
 * **without emitting**. Intended for normalize-on-read paths (e.g. defaults
 * applied during render). Emitting here would re-enter `refreshView` via
 * the CONFIG_UPDATED subscription and loop. Use
 * {@link updateActiveDatasetConfig} when an emit is wanted.
 *
 * @param {(config: Object) => Object} normalizer
 */
export function normalizeActiveDatasetConfig(normalizer) {
	return dataState.normalizeActiveDatasetConfig(normalizer);
}

/**
 * Radio-style chart-type activation. Enables exactly one chart type (or
 * none if `null`); optional overrides are merged into the activated chart's
 * config in the same mutation, so toggle handlers don't have to fire a
 * second event.
 *
 * @param {ChartTypeKey | null} chartType
 * @param {Object | null} [activatedOverrides]
 * @fires STATE_EVENTS.CONFIG_UPDATED - Single emit per call.
 */
export function setActiveChartType(chartType, activatedOverrides) {
	return dataState.setActiveChartType(chartType, activatedOverrides);
}

// ─── Panel domain ───────────────────────────────────────────────────────

/**
 * @returns {ChartSnapshot[]} Live reference to the snapshots array. Do not mutate.
 */
export function getPanelCharts() {
	return panelState.getPanelCharts();
}

/**
 * Append a chart snapshot.
 *
 * @param {Partial<ChartSnapshot>} chartSnapshot
 * @returns {number} New snapshot id.
 * @fires STATE_EVENTS.CHART_ADDED
 */
export function addChartSnapshot(chartSnapshot) {
	return panelState.addChartSnapshot(chartSnapshot);
}

/**
 * Remove a chart snapshot and clear references to it from every slot map.
 * No-op (no event) when `chartId` is non-numeric.
 *
 * @param {number | string} chartId
 * @fires STATE_EVENTS.CHART_REMOVED
 */
export function removeChartSnapshot(chartId) {
	return panelState.removeChartSnapshot(chartId);
}

/**
 * @param {number | string} chartId
 * @returns {ChartSnapshot | null} Live reference. `null` when not found.
 */
export function getChartSnapshot(chartId) {
	return panelState.getChartSnapshot(chartId);
}

/**
 * Read the block list. Side effect: ensures at least one default block
 * exists.
 *
 * @returns {PanelBlock[]} Live reference. Do not mutate.
 */
export function getPanelBlocks() {
	return panelState.getPanelBlocks();
}

/**
 * Reset the panel to a single fresh `template-2col` block.
 *
 * @fires STATE_EVENTS.PANEL_CLEARED
 */
export function clearPanel() {
	return panelState.clearPanel();
}

/**
 * Drop slot assignments that point at missing snapshot ids. Does not emit.
 */
export function validatePanelSlots() {
	return panelState.validatePanelSlots();
}

/**
 * Append a new block. Capped at 4 blocks per panel.
 *
 * @param {PanelTemplateId} [templateId='template-2col']
 * @returns {string | null} New block id, or `null` when at the limit.
 * @fires STATE_EVENTS.PANEL_BLOCK_ADDED
 */
export function addPanelBlock(templateId = 'template-2col') {
	return panelState.addPanelBlock(templateId);
}

/**
 * Remove a block; inserts a fresh `template-2col` block if removal would
 * empty the panel.
 *
 * @param {string} blockId
 * @fires STATE_EVENTS.PANEL_BLOCK_REMOVED
 */
export function removePanelBlock(blockId) {
	return panelState.removePanelBlock(blockId);
}

/**
 * Reorder a block. `targetIndex` is clamped to a valid range.
 *
 * @param {string} blockId
 * @param {number} targetIndex
 * @fires STATE_EVENTS.PANEL_BLOCK_MOVED
 */
export function movePanelBlock(blockId, targetIndex) {
	return panelState.movePanelBlock(blockId, targetIndex);
}

/**
 * Update split proportions. Each value clamped to `[20, 80]`.
 *
 * @param {string} blockId
 * @param {Partial<PanelBlockProportions>} partialProportions
 * @fires STATE_EVENTS.PANEL_BLOCK_PROPORTIONS_UPDATED
 */
export function updatePanelBlockProportions(blockId, partialProportions) {
	return panelState.updatePanelBlockProportions(blockId, partialProportions);
}

/**
 * Set a block's pixel height. Clamped to `[220, 760]`.
 *
 * @param {string} blockId
 * @param {number} heightPx
 * @fires STATE_EVENTS.PANEL_BLOCK_HEIGHT_UPDATED
 */
export function updatePanelBlockHeight(blockId, heightPx) {
	return panelState.updatePanelBlockHeight(blockId, heightPx);
}

/**
 * Toggle and/or recolor a block's border. Invalid colors are silently ignored.
 *
 * @param {string} blockId
 * @param {{ enabled?: boolean, color?: string }} [options]
 * @fires STATE_EVENTS.PANEL_BLOCK_BORDER_UPDATED
 */
export function updatePanelBlockBorder(blockId, options = {}) {
	return panelState.updatePanelBlockBorder(blockId, options);
}

/**
 * Change a block's layout template. Slots not present in the new template
 * are dropped.
 *
 * @param {string} blockId
 * @param {PanelTemplateId} templateId
 * @returns {boolean} `true` on success, `false` when the block was not found.
 * @fires STATE_EVENTS.PANEL_BLOCK_TEMPLATE_CHANGED
 */
export function setPanelBlockTemplate(blockId, templateId) {
	return panelState.setPanelBlockTemplate(blockId, templateId);
}

/**
 * Bind a chart snapshot to a block slot. Pass `chartId === null` to clear
 * the slot.
 *
 * @param {string} blockId
 * @param {string} slotId
 * @param {number | null} chartId
 * @throws {Error} When `chartId` is non-null and no matching snapshot exists.
 * @fires STATE_EVENTS.PANEL_BLOCK_SLOT_ASSIGNED
 */
export function assignChartToPanelBlockSlot(blockId, slotId, chartId) {
	return panelState.assignChartToPanelBlockSlot(blockId, slotId, chartId);
}

// ─── UI domain ──────────────────────────────────────────────────────────

/**
 * Switch the sidebar mode. No-op when already in the requested mode.
 *
 * @param {SidebarMode} mode
 * @throws {Error} When `mode` is not one of `'data' | 'viz' | 'panel'`.
 * @fires STATE_EVENTS.SIDEBAR_MODE_CHANGED
 */
export function setSidebarMode(mode) {
	return uiState.setSidebarMode(mode);
}

/**
 * Set the preview-table row count.
 *
 * @param {number} rows - Must be ≥ 1.
 * @throws {Error} When `rows < 1`.
 * @fires STATE_EVENTS.PREVIEW_ROWS_CHANGED
 */
export function setPreviewRows(rows) {
	return uiState.setPreviewRows(rows);
}

/**
 * Atomically replace the entire state. Bypasses the facades — used by
 * `persistenceService` for hydration on boot.
 *
 * Missing fields fall back to the current default shape so a partial
 * payload (e.g. an older persisted schema) cannot leave the app in a
 * broken state. Emits a single STATE_HYDRATED event after all writes land.
 *
 * @param {Partial<AppState>} [snapshot={}]
 * @fires STATE_EVENTS.STATE_HYDRATED - Single emit per call.
 */
export function replaceAllState({ data, panel, ui } = {}) {
	if (data && typeof data === 'object') {
		appState.data.datasets = Array.isArray(data.datasets) ? data.datasets : [];
		const idx = Number.isInteger(data.activeIndex) ? data.activeIndex : -1;
		appState.data.activeIndex = idx >= -1 && idx < appState.data.datasets.length ? idx : -1;
	}

	if (panel && typeof panel === 'object') {
		appState.panel.charts = Array.isArray(panel.charts) ? panel.charts : [];
		appState.panel.slots = panel.slots && typeof panel.slots === 'object' ? panel.slots : {};
		appState.panel.layout = typeof panel.layout === 'string' ? panel.layout : 'template-2col';

		// Seed nextBlockId BEFORE synthesizing the fallback default block, so the
		// synthesized block uses the requested id (and nextBlockId auto-increments
		// past it) rather than whatever value leaked in from a prior call.
		const hasProvidedNextBlockId = Number.isInteger(panel.nextBlockId) && panel.nextBlockId > 0;
		if (hasProvidedNextBlockId) {
			appState.panel.nextBlockId = panel.nextBlockId;
		}
		appState.panel.blocks = Array.isArray(panel.blocks) && panel.blocks.length > 0
			? panel.blocks
			: [createPanelBlock('template-2col')];
		if (!hasProvidedNextBlockId) {
			appState.panel.nextBlockId = appState.panel.blocks.length + 1;
		}

		appState.panel.nextChartId = Number.isInteger(panel.nextChartId) && panel.nextChartId >= 0
			? panel.nextChartId
			: (appState.panel.charts.reduce((max, c) => Math.max(max, c.id ?? -1), -1) + 1);
	}

	if (ui && typeof ui === 'object') {
		if (['data', 'viz', 'panel'].includes(ui.sidebarMode)) {
			appState.ui.sidebarMode = ui.sidebarMode;
		}
		if (Number.isInteger(ui.previewRows) && ui.previewRows >= 1) {
			appState.ui.previewRows = ui.previewRows;
		}
	}

	emitStateChange(STATE_EVENTS.STATE_HYDRATED);
}

/**
 * Mirror selected state fields onto `window.*` globals for legacy hooks
 * that still read from globals. New code must not depend on these — read
 * via the getters in this module instead.
 *
 * @deprecated Legacy compatibility shim. Slated for removal once all
 *   external hooks migrate to the typed getters; until then, `stateSync`
 *   refreshes these on every emission.
 */
export function exposeGlobals() {
	window.datasetsCarregados = appState.data.datasets;
	window.datasetAtivo = getActiveDataset();
	window.dadosCarregados = getActiveDataset()?.rows || null;
	window.colunasDetectadas = getActiveDataset()?.columns || null;
	window.colunasSelecionadasAtivas = getActiveDataset()?.selectedColumns || null;
	window.chartsPainel = appState.panel.charts;
	window.slotsPainel = appState.panel.slots;
	window.layoutPainelAtual = appState.panel.layout;
}
