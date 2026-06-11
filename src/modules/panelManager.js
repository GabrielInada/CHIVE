/**
 * CHIVE Panel Manager.
 *
 * Orchestrator module that coordinates panel composition:
 *   - Adding/removing chart snapshots
 *   - Managing block slots and layouts
 *   - Delegating rendering to `panel/panelRenderer.js`
 *   - Delegating resize to `panel/panelResize.js`
 *   - Delegating export to `panel/panelExporter.js`
 *
 * Security note: uses `textContent` for all user-provided names to prevent XSS.
 *
 * @typedef {import('../types.js').ChartSnapshot} ChartSnapshot
 * @typedef {import('../types.js').Result} Result
 * @typedef {import('../types.js').PanelTemplateId} PanelTemplateId
 */

import { t } from '../services/i18nService.js';
import { ok, fail } from '../utils/result.js';
import { mergeChartConfigWithDefaults } from '../config/chartDefaults.js';
import { applyGlobalFilterRules, resolveGlobalFilterForColumns } from '../utils/globalFilter.js';
import { getNumericColumnNames } from '../utils/columnHelpers.js';
import {
	PANEL_LAYOUTS,
	getLayoutConfig as getPanelLayoutConfig,
} from './panelSubsystem/layoutConfig.js';
import {
	getPanelBlocks,
	getActiveDataset,
	addChartSnapshot,
	removeChartSnapshot,
	getChartSnapshot,
	setPanelBlockTemplate,
	addPanelBlock,
	removePanelBlock,
	movePanelBlock,
	updatePanelBlockBorder,
	assignChartToPanelBlockSlot,
	updatePanelBlockProportions,
	updatePanelBlockHeight,
	validatePanelSlots,
	clearPanel,
	onStateChange,
	STATE_EVENTS,
} from './state/appState.js';
import {
	renderSidebarPanel as renderSidebar,
	renderCanvasPanel as renderCanvas,
	fillLayoutSelect,
} from './panelSubsystem/panelRenderer.js';
import { exportPanelLayoutSvg as exportSvg } from './panelSubsystem/panelExporter.js';
import { SUPPORTED_PANEL_CHART_TYPES } from './panelSubsystem/renderChartFromSpec.js';

// Callback for feedback UI (will be set by main.js)
let feedbackCallback = null;

// Guard: prevents duplicate listener registration if initPanelManager is called more than once
let panelManagerInitialized = false;

// Unsubscribe functions returned by onStateChange in initPanelManager. Kept so
// _resetPanelManagerForTesting can detach listeners between tests; without
// this, repeated init/reset cycles append fresh subscribers to the same bus.
let panelSubscriptions = [];

/**
 * Initialize the panel manager. Wires panel-related state-event listeners
 * exactly once; subsequent calls update only the feedback callback.
 *
 * @param {((message: string, kind?: 'success' | 'error') => void) | null} [feedbackFn] - Callback for user feedback. When `null`, panel actions fall back to silent operation.
 */
export function initPanelManager(feedbackFn = null) {
	// Always update the feedback callback, callers may legitimately
	// pass a different function without intending to re-register listeners.
	feedbackCallback = feedbackFn;

	if (panelManagerInitialized) return;
	panelManagerInitialized = true;

	// Re-render when state changes
	panelSubscriptions.push(onStateChange(STATE_EVENTS.CHART_ADDED, handleChartStateChange));
	panelSubscriptions.push(onStateChange(STATE_EVENTS.CHART_REMOVED, handleChartStateChange));
	panelSubscriptions.push(onStateChange(STATE_EVENTS.PANEL_BLOCK_SLOT_ASSIGNED, handleChartStateChange));
	panelSubscriptions.push(onStateChange(STATE_EVENTS.PANEL_BLOCK_ADDED, handleLayoutChange));
	panelSubscriptions.push(onStateChange(STATE_EVENTS.PANEL_BLOCK_REMOVED, handleLayoutChange));
	panelSubscriptions.push(onStateChange(STATE_EVENTS.PANEL_BLOCK_MOVED, handleLayoutChange));
	panelSubscriptions.push(onStateChange(STATE_EVENTS.PANEL_BLOCK_TEMPLATE_CHANGED, handleLayoutChange));
	panelSubscriptions.push(onStateChange(STATE_EVENTS.PANEL_BLOCK_PROPORTIONS_UPDATED, handleLayoutChange));
	panelSubscriptions.push(onStateChange(STATE_EVENTS.PANEL_BLOCK_HEIGHT_UPDATED, handleLayoutChange));
	panelSubscriptions.push(onStateChange(STATE_EVENTS.PANEL_BLOCK_BORDER_UPDATED, handleLayoutChange));
}

/**
 * Reset initialization state for testing purposes only.
 * Do not call this in production code.
 * @internal
 */
export function _resetPanelManagerForTesting() {
	panelSubscriptions.forEach(unsubscribe => unsubscribe());
	panelSubscriptions = [];
	panelManagerInitialized = false;
}

/**
 * Handle chart state changes - re-render UI
 * @private
 */
function handleChartStateChange() {
	renderSidebarPanel();
	renderCanvasPanel();
}

/**
 * Handle layout changes
 * @private
 */
function handleLayoutChange() {
	renderCanvasPanel();
	fillLayoutSelect();
}

// =============================================================================
// FACADE-WRITE CALLBACKS (injected into panelSubsystem renderers)
// =============================================================================
// These thin handlers are the only place that calls the panel write facades on
// behalf of user actions surfaced by panelRenderer.js and panelResize.js. The
// renderers receive them via the callback bag passed to renderCanvasPanel();
// they never import write facades directly. Re-renders happen via the bus
// subscriptions in initPanelManager(), not via direct calls from the
// renderer's handlers.

function handleAddBlock(templateId) {
	const newBlockId = addPanelBlock(templateId);
	if (newBlockId === null && feedbackCallback) {
		feedbackCallback(t('chive-panel-max-blocks'), 'error');
	}
}

function handleMoveBlock(blockId, newIndex) {
	movePanelBlock(blockId, newIndex);
}

function handleRemoveBlock(blockId) {
	removePanelBlock(blockId);
}

function handleChangeBlockTemplate(blockId, templateId) {
	setPanelBlockTemplate(blockId, templateId);
}

function handleUpdateBlockBorder(blockId, patch) {
	updatePanelBlockBorder(blockId, patch);
}

function handleAssignSlot(blockId, slotId, chartId) {
	assignChartToPanelBlockSlot(blockId, slotId, chartId);
}

function handleUpdateBlockProportions(blockId, proportions) {
	updatePanelBlockProportions(blockId, proportions);
}

function handleUpdateBlockHeight(blockId, heightPx) {
	updatePanelBlockHeight(blockId, heightPx);
}

/**
 * Capture a chart's current state as a snapshot and add it to the panel.
 * Reads the active dataset, merges its `chartConfig` with chart defaults,
 * applies the global filter, and stores a {@link ChartSnapshot} via the
 * panel facade.
 *
 * @param {string} containerId - DOM element ID of the chart container (unused inside the function; preserved for caller traceability).
 * @param {string} chartBaseName - Display name for the snapshot.
 * @param {Object | null} [metadata] - Chart-specific metadata (must include `type: ChartTypeKey`). When the type is missing or not supported, the call fails with `'unknown-type'`.
 * @returns {Result} On success: `{ ok: true, chartId }` with the new snapshot id. On failure: `{ ok: false, reason }` where reason is `'unknown-type'`, `'no-dataset'`, or `'add-error'`.
 * @fires STATE_EVENTS.CHART_ADDED - On success.
 */
export function addChartToPanel(containerId, chartBaseName, metadata = null) {
	try {
		const type = metadata?.type;
		if (!type || !SUPPORTED_PANEL_CHART_TYPES.includes(type)) {
			return fail('unknown-type');
		}

		const dataset = getActiveDataset();
		if (!dataset) return fail('no-dataset');

		const mergedConfig = mergeChartConfigWithDefaults(dataset.chartConfig);
		const allColumnNames = Array.isArray(dataset.columns)
			? dataset.columns.map(column => column?.name).filter(Boolean)
			: [];
		const numericColumnNames = getNumericColumnNames(dataset.columns || []);
		const safeGlobalFilter = resolveGlobalFilterForColumns(mergedConfig.globalFilter, allColumnNames);
		const filteredRows = applyGlobalFilterRules(dataset.rows || [], safeGlobalFilter, numericColumnNames);

		const chartId = addChartSnapshot({
			name: chartBaseName,
			type,
			config: structuredClone(mergedConfig[type] || {}),
			dataSnapshot: structuredClone(filteredRows),
			columnsSnapshot: structuredClone(dataset.columns || []),
			metadata,
			metaSummary: typeof metadata?.summary === 'string' ? metadata.summary : '',
		});

		renderSidebarPanel();
		renderCanvasPanel();
		return ok({ chartId });
	} catch {
		if (feedbackCallback) {
			feedbackCallback(t('chive-panel-add-error'), 'error');
		}
		return fail('add-error');
	}
}

/**
 * Remove a chart snapshot from the panel. Delegates to the panel facade,
 * then re-renders sidebar + canvas.
 *
 * @param {number | string} chartId
 * @fires STATE_EVENTS.CHART_REMOVED - When the snapshot existed.
 */
export function removeChartFromPanel(chartId) {
	removeChartSnapshot(chartId);
	renderSidebarPanel();
	renderCanvasPanel();
}

/**
 * Look up a chart snapshot by id.
 *
 * @param {number | string} chartId
 * @returns {ChartSnapshot | null} Live reference, or `null` when not found.
 */
export function getChartById(chartId) {
	return getChartSnapshot(chartId);
}

/**
 * Look up a layout descriptor from `panel/layoutConfig.js`.
 *
 * @param {PanelTemplateId} layoutId
 * @returns {Object} Layout configuration (template definition, slot list, defaults).
 */
export function getLayoutConfig(layoutId) {
	return getPanelLayoutConfig(layoutId);
}

/**
 * Render the panel sidebar (list of saved chart snapshots). The actual
 * rendering lives in `panel/panelRenderer.js`; this entry passes the
 * `removeChartFromPanel` callback so sidebar items can be deleted.
 */
export function renderSidebarPanel() {
	renderSidebar(removeChartFromPanel);
}

/**
 * Render the panel canvas (layout templates with mounted chart slots).
 * Re-rendering is driven by the bus subscriptions in initPanelManager(),
 * not by recursive calls from the renderer: every facade write the renderer
 * triggers via the callback bag below fans out to the matching
 * STATE_EVENTS.* subscription, which calls back into this function.
 */
export function renderCanvasPanel() {
	validatePanelSlots();
	renderCanvas({
		onAddBlock: handleAddBlock,
		onMoveBlock: handleMoveBlock,
		onRemoveBlock: handleRemoveBlock,
		onChangeBlockTemplate: handleChangeBlockTemplate,
		onUpdateBlockBorder: handleUpdateBlockBorder,
		onAssignSlot: handleAssignSlot,
		onUpdateBlockProportions: handleUpdateBlockProportions,
		onUpdateBlockHeight: handleUpdateBlockHeight,
	});
}

/**
 * Change the panel's first-block layout template and re-render.
 * No-op when `layoutId` is not a known layout, or when the panel has no
 * blocks.
 *
 * @param {PanelTemplateId} layoutId
 * @fires STATE_EVENTS.PANEL_BLOCK_TEMPLATE_CHANGED - When the change applies.
 */
export function changeLayout(layoutId) {
	if (!PANEL_LAYOUTS[layoutId]) {
		return;
	}
	const blocks = getPanelBlocks();
	if (!blocks[0]) return;
	setPanelBlockTemplate(blocks[0].id, layoutId);
}

/**
 * Export the rendered panel as an SVG file. Delegates to
 * `panel/panelExporter.js`.
 *
 * @returns {Result} `{ ok: true }` on success; `{ ok: false, reason }` where reason is `'canvas-not-found'` or `'empty-canvas'`.
 */
export function exportPanelLayoutSvg() {
	return exportSvg(feedbackCallback);
}

/**
 * Wire change/click listeners on the layout `<select>` and the export
 * button. Idempotent in practice, both elements get a fresh listener
 * each call, so callers should invoke this at most once.
 */
export function setupPanelEventListeners() {
	const selectLayout = document.getElementById('select-panel-layout');
	const btnExportar = document.getElementById('btn-export-panel');

	if (selectLayout) {
		selectLayout.addEventListener('change', e => {
			changeLayout(e.target.value);
		});
	}

	if (btnExportar) {
		btnExportar.addEventListener('click', () => {
			const result = exportPanelLayoutSvg();
			if (!result.ok) {
				if (feedbackCallback) {
					let msg = t('chive-panel-export-error');
					if (result.reason === 'canvas-not-found') {
						msg = 'Panel canvas not found';
					} else if (result.reason === 'empty-canvas') {
						msg = 'Panel is empty';
					}
					feedbackCallback(msg, 'error');
				}
			} else {
				if (feedbackCallback) {
					feedbackCallback(t('chive-panel-export-svg'), 'success');
				}
			}
		});
	}

}

/**
 * Populate the layout `<select>` with the available templates and the
 * currently-active layout pre-selected. Pure rendering call; safe to
 * invoke on every state change.
 */
export function initializeLayoutSelector() {
	fillLayoutSelect();
}

/**
 * Reset the panel to a single fresh `template-2col` block and re-render.
 *
 * @fires STATE_EVENTS.PANEL_CLEARED
 */
export function clearPanelData() {
	clearPanel();
	renderSidebarPanel();
	renderCanvasPanel();
}
