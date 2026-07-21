import { emitStateChange, onStateChange, STATE_EVENTS } from './stateEvents.js';
import { createPanelBlockModel } from '../domain/panel/panelBlockModel.js';
import { normalizeTemplateId } from '../domain/panel/layoutTemplates.js';
import { canonicalizeChartConfig } from '../domain/charts/chartConfig.js';
import { PREVIEW_DEFAULT_ROWS, PREVIEW_MAX_ROWS, PREVIEW_MIN_ROWS } from '../config/limits.js';
import { getDatasetColumnNames, normalizeColumnNameList } from '../domain/datasets/columns.js';
import { createDataStateFacade } from './dataStateFacade.js';
import { createUiStateFacade } from './uiStateFacade.js';
import { createPanelStateFacade } from './panelStateFacade.js';

export { onStateChange, STATE_EVENTS };

/**
 * CHIVE application state, single source of truth.
 *
 * The private `appState` object below is never exported. All reads go
 * through `get*` functions; all writes go through the three domain facades
 * (data, ui, panel) whose methods are re-exported as the convenience API.
 *
 * Note on block construction: `createPanelBlockModel` (imported from
 * `domain/panel/panelBlockModel.js`) is the pure constructor that takes
 * an explicit id. The local `createPanelBlock` below is a closure that
 * calls it AND increments `appState.panel.nextBlockId`. That closure is
 * the one passed into the panel facade. Do not conflate the two.
 *
 * @typedef {import('../types.js').AppState} AppState
 * @typedef {import('../types.js').Dataset} Dataset
 * @typedef {import('../types.js').ChartSnapshot} ChartSnapshot
 * @typedef {import('../types.js').PanelBlock} PanelBlock
 * @typedef {import('../types.js').PanelTemplateId} PanelTemplateId
 * @typedef {import('../types.js').PanelBlockProportions} PanelBlockProportions
 * @typedef {import('../types.js').SidebarMode} SidebarMode
 * @typedef {import('../types.js').ChartTypeKey} ChartTypeKey
 *
 * @see docs/development/architecture.md
 * @see CONTRIBUTING.md "Architecture invariants, do not break"
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
		previewRows: PREVIEW_DEFAULT_ROWS,
	},
};

const PANEL_BLOCK_LIMIT = 4;
const PANEL_BLOCK_MIN_HEIGHT = 220;
const PANEL_BLOCK_MAX_HEIGHT = 760;

/**
 * Build a new panel block AND advance the monotonic id counter. The id is
 * stamped into the block via `createPanelBlockModel` (the pure
 * constructor); the counter increment is the side effect that lives here.
 *
 * @private
 * @param {PanelTemplateId} [templateId='template-2col']
 * @returns {PanelBlock}
 */
function createPanelBlock(templateId = 'template-2col') {
	const block = createPanelBlockModel(appState.panel.nextBlockId, templateId);
	appState.panel.nextBlockId += 1;
	return block;
}

/**
 * Keep the persisted compatibility field aligned with the authoritative first
 * block. Template ids reaching this boundary are canonicalized before either
 * field is written.
 *
 * @private
 */
function syncPanelLayout() {
	const firstBlock = appState.panel.blocks[0];
	if (!firstBlock) return;
	const templateId = normalizeTemplateId(firstBlock.templateId);
	firstBlock.templateId = templateId;
	appState.panel.layout = templateId;
}

/**
 * Insert a block using the canonical compatibility layout when `panel.blocks`
 * is empty (or has been replaced by a non-array), then synchronize
 * `panel.layout` with the first block. Called from every panel-facade method
 * that touches `blocks`, this is why several "getter" methods on the facade
 * have a mutation as a side effect.
 *
 * @private
 */
function ensureDefaultPanelBlock() {
	if (!Array.isArray(appState.panel.blocks)) {
		appState.panel.blocks = [];
	}
	if (appState.panel.blocks.length === 0) {
		appState.panel.blocks.push(createPanelBlock(normalizeTemplateId(appState.panel.layout)));
	}
	syncPanelLayout();
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
	syncPanelLayout,
	sanitizeChartName,
	panelBlockLimit: PANEL_BLOCK_LIMIT,
	panelBlockMinHeight: PANEL_BLOCK_MIN_HEIGHT,
	panelBlockMaxHeight: PANEL_BLOCK_MAX_HEIGHT,
});

/**
 * Read a deep clone of the entire state. Safe to mutate without affecting
 * the real state, contrast with the live-reference getters
 * ({@link getAllDatasets}, {@link getPanelCharts}, {@link getPanelBlocks}).
 *
 * @returns {AppState} Deep clone.
 */
export function getState() {
	return JSON.parse(JSON.stringify(appState));
}

/**
 * Assemble the persistence-shaped snapshot from LIVE references, with no
 * deep clone. This is the save path's read accessor: it lets the worker
 * backend reference-compare dataset rows / chart snapshots to skip
 * re-sending unchanged payloads, and it keeps the heavy JSON clone that
 * {@link getState} performs off the auto-save hot path.
 *
 * The returned object is a fresh envelope, but `datasets`, `panel`, and `ui`
 * are the real state references. Do not mutate them, treat this exactly like
 * {@link getAllDatasets} / {@link getPanelCharts}. The reference-identity
 * dedup in the worker backend relies on sanctioned writes replacing dataset
 * `rows` and chart `dataSnapshot`/`columnsSnapshot` references rather than
 * editing those arrays in place. Mutating a live getter result violates that
 * contract and can invalidate persistence deduplication.
 *
 * @returns {AppState} Live-reference view. Do not mutate.
 */
export function getPersistenceSnapshot() {
	return {
		data: {
			datasets: appState.data.datasets,
			activeIndex: appState.data.activeIndex,
		},
		panel: appState.panel,
		ui: appState.ui,
	};
}

// ─── Data domain ────────────────────────────────────────────────────────

/**
 * @returns {Dataset | null} Live reference to the active dataset, or `null` when none is selected. Do not mutate.
 */
export function getActiveDataset() {
	return dataState.getActiveDataset();
}

/**
 * @returns {number} Active dataset index, or `-1` when none is selected.
 */
export function getActiveDatasetIndex() {
	return dataState.getActiveDatasetIndex();
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
 * @throws {Error} When `index` is not an integer, is less than `-1`, or is beyond the datasets array.
 * @fires STATE_EVENTS.ACTIVE_DATASET - Only when the index changes.
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
 * Remove a dataset while preserving detached panel captures and all of their
 * slot assignments.
 *
 * @param {number} index - In-range integer dataset index.
 * @throws {Error} When `index` is not an in-range integer.
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
 * Replace the active dataset's selected-column list with a copied array of
 * unique declared names. No-op when no dataset is active or the ordered list
 * is unchanged.
 *
 * @param {string[]} columnNames
 * @throws {Error} When an active dataset exists and the list contains duplicates or undeclared/non-string names.
 * @fires STATE_EVENTS.COLUMNS_UPDATED - Only when the ordered list changes.
 */
export function updateActiveDatasetColumns(columnNames) {
	return dataState.updateActiveDatasetColumns(columnNames);
}

/**
 * Apply a normalizer to the active dataset's `chartConfig`
 * **without emitting**. Config is canonicalized at the state boundaries
 * (persistence restore, `addDataset`, and the emitting config writes) via
 * `canonicalizeChartConfig`; this escape hatch exists for the intentional
 * non-emitting live-preview writes (color picker, chart-height drag). Emitting
 * here would re-enter the render coordinator's `refreshView` via the
 * CONFIG_UPDATED subscription and loop; use
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
 * A well-formed id with no matching snapshot is a no-op.
 *
 * @param {number | string} chartId - Non-negative safe integer or decimal-integer DOM string.
 * @throws {Error} When `chartId` is malformed.
 * @fires STATE_EVENTS.CHART_REMOVED - Only when a matching snapshot is removed.
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
 * @throws {Error} When `templateId` is not an exact registry id.
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
 * @fires STATE_EVENTS.PANEL_BLOCK_REMOVED - Only when a matching block is removed.
 */
export function removePanelBlock(blockId) {
	return panelState.removePanelBlock(blockId);
}

/**
 * Reorder a block. `targetIndex` is clamped to a valid range.
 *
 * @param {string} blockId
 * @param {number} targetIndex - Integer clamped to a valid range.
 * @throws {Error} When the block exists and `targetIndex` is not an integer.
 * @fires STATE_EVENTS.PANEL_BLOCK_MOVED - Only when the block's final index changes.
 */
export function movePanelBlock(blockId, targetIndex) {
	return panelState.movePanelBlock(blockId, targetIndex);
}

/**
 * Atomically validate and update template-supported split proportions. Finite
 * numeric values are clamped to `[20, 80]`.
 *
 * @param {string} blockId
 * @param {Partial<PanelBlockProportions>} partialProportions
 * @throws {Error} When the block exists and the patch shape, a key, or a value is invalid.
 * @fires STATE_EVENTS.PANEL_BLOCK_PROPORTIONS_UPDATED - Only when a value changes.
 */
export function updatePanelBlockProportions(blockId, partialProportions) {
	return panelState.updatePanelBlockProportions(blockId, partialProportions);
}

/**
 * Set a block's pixel height. Clamped to `[220, 760]`.
 *
 * @param {string} blockId
 * @param {number} heightPx
 * @throws {Error} When the block exists and `heightPx` is not a finite number.
 * @fires STATE_EVENTS.PANEL_BLOCK_HEIGHT_UPDATED - Only when the rounded/clamped value changes.
 */
export function updatePanelBlockHeight(blockId, heightPx) {
	return panelState.updatePanelBlockHeight(blockId, heightPx);
}

/**
 * Atomically validate and update a block's optional border fields.
 *
 * @param {string} blockId
 * @param {{ enabled?: boolean, color?: string }} [options]
 * @throws {Error} When the block exists and the patch shape or a supplied field is invalid.
 * @fires STATE_EVENTS.PANEL_BLOCK_BORDER_UPDATED - Only when a value changes.
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
 * @returns {boolean} `true` for an existing block, including same-template no-op; `false` when not found.
 * @throws {Error} When the block exists and `templateId` is not registered.
 * @fires STATE_EVENTS.PANEL_BLOCK_TEMPLATE_CHANGED - Only when the template changes.
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
 * @param {number | string | null} chartId
 * @throws {Error} When the block exists and the slot is unsupported, the chart id is malformed, or no matching snapshot exists.
 * @fires STATE_EVENTS.PANEL_BLOCK_SLOT_ASSIGNED - Only when the assignment changes.
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
 * @param {number} rows - Integer from 1 through 1000.
 * @throws {Error} When `rows` is not an integer in the supported range.
 * @fires STATE_EVENTS.PREVIEW_ROWS_CHANGED - Only when the value changes.
 */
export function setPreviewRows(rows) {
	return uiState.setPreviewRows(rows);
}

/**
 * @returns {number} Current preview-table row count.
 */
export function getPreviewRows() {
	return uiState.getPreviewRows();
}

/**
 * Hydrate the supplied top-level slices synchronously, bypassing ordinary
 * facade writes. Omitted or non-object slices remain unchanged. Supplied data
 * and panel slices default missing fields; valid UI fields overwrite their
 * current values independently. Observers receive one STATE_HYDRATED event
 * after all supplied writes land.
 *
 * Canonicalization changes in-memory state only. Hydration itself is ignored
 * by autosave, so persisted bytes are not rewritten until a later dirty event
 * leads to a successful save.
 *
 * @param {Partial<AppState>} [snapshot={}]
 * @fires STATE_EVENTS.STATE_HYDRATED - Single emit per call.
 */
export function replaceAllState({ data, panel, ui } = {}) {
	if (data && typeof data === 'object') {
		const rawDatasets = Array.isArray(data.datasets) ? data.datasets : [];
		// Defensive canonicalization: replaceAllState is a public hydration escape
		// hatch that can receive unsanitized input. Map to shallow copies with a
		// canonical chartConfig (no in-place mutation of the caller's objects); leave
		// non-object entries untouched so a malformed entry cannot throw here.
		appState.data.datasets = rawDatasets.map(dataset => {
			if (dataset === null || typeof dataset !== 'object' || Array.isArray(dataset)) {
				return dataset;
			}
			const columnNames = getDatasetColumnNames(dataset) || [];
			return {
				...dataset,
				selectedColumns: normalizeColumnNameList(dataset.selectedColumns, {
					allowed: new Set(columnNames),
					max: Infinity,
				}),
				chartConfig: canonicalizeChartConfig(dataset.chartConfig, columnNames),
			};
		});
		const idx = Number.isInteger(data.activeIndex) ? data.activeIndex : -1;
		appState.data.activeIndex = idx >= -1 && idx < appState.data.datasets.length ? idx : -1;
	}

	if (panel && typeof panel === 'object') {
		appState.panel.charts = Array.isArray(panel.charts) ? panel.charts : [];
		appState.panel.slots = panel.slots && typeof panel.slots === 'object' ? panel.slots : {};
		const legacyLayout = normalizeTemplateId(panel.layout);
		appState.panel.layout = legacyLayout;

		// Seed nextBlockId BEFORE synthesizing the fallback default block, so the
		// synthesized block uses either the requested id or a fresh default rather
		// than a counter leaked from a prior partial hydration.
		const hasProvidedNextBlockId = Number.isInteger(panel.nextBlockId) && panel.nextBlockId > 0;
		appState.panel.nextBlockId = hasProvidedNextBlockId ? panel.nextBlockId : 1;
		const suppliedBlocks = Array.isArray(panel.blocks)
			? panel.blocks
				.filter(block => block !== null && typeof block === 'object' && !Array.isArray(block))
				.map(block => ({ ...block, templateId: normalizeTemplateId(block.templateId) }))
			: [];
		appState.panel.blocks = suppliedBlocks.length > 0
			? suppliedBlocks
			: [createPanelBlock(legacyLayout)];
		if (!hasProvidedNextBlockId) {
			appState.panel.nextBlockId = appState.panel.blocks.length + 1;
		}
		syncPanelLayout();

		appState.panel.nextChartId = Number.isInteger(panel.nextChartId) && panel.nextChartId >= 0
			? panel.nextChartId
			: (appState.panel.charts.reduce((max, c) => Math.max(max, c.id ?? -1), -1) + 1);
	}

	if (ui && typeof ui === 'object') {
		if (['data', 'viz', 'panel'].includes(ui.sidebarMode)) {
			appState.ui.sidebarMode = ui.sidebarMode;
		}
		if (
			Number.isInteger(ui.previewRows)
			&& ui.previewRows >= PREVIEW_MIN_ROWS
			&& ui.previewRows <= PREVIEW_MAX_ROWS
		) {
			appState.ui.previewRows = ui.previewRows;
		}
	}

	emitStateChange(STATE_EVENTS.STATE_HYDRATED);
}
