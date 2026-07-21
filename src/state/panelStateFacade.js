import {
	addChartSnapshotToState,
	addPanelBlockState,
	assignChartToPanelBlockSlotState,
	clearPanelState,
	getChartSnapshotFromState,
	movePanelBlockState,
	removeChartSnapshotFromState,
	removePanelBlockState,
	setPanelBlockTemplateState,
	updatePanelBlockBorderState,
	updatePanelBlockHeightState,
	updatePanelBlockProportionsState,
	validatePanelSlotsState,
} from './panel/mutations.js';
import {
	createDefaultProportions,
	getTemplateSlots,
	PANEL_LAYOUTS,
} from '../domain/panel/layoutTemplates.js';
import { clampPercentage } from '../domain/panel/panelBlockModel.js';
import { STATE_EVENTS } from './stateEvents.js';

/**
 * CHIVE panel-domain facade.
 *
 * Owns every write into `appState.panel`. The mutation helpers in
 * `./panel/mutations.js` are `@internal` and must not be
 * imported from outside this module; they assume the caller is the facade and
 * skip event emission.
 *
 * @typedef {import('../types.js').AppState} AppState
 * @typedef {import('../types.js').ChartSnapshot} ChartSnapshot
 * @typedef {import('../types.js').PanelBlock} PanelBlock
 * @typedef {import('../types.js').PanelTemplateId} PanelTemplateId
 * @typedef {import('../types.js').PanelBlockProportions} PanelBlockProportions
 *
 * @see docs/development/architecture.md
 * @see CONTRIBUTING.md "Architecture invariants, do not break"
 */

/**
 * Build the panel-domain facade. Injected dependencies cover state writes
 * (`appState`, `emitStateChange`), block construction (`createPanelBlock`,
 * `ensureDefaultPanelBlock`), input sanitization (`sanitizeChartName`), and
 * the per-instance limits (`panelBlockLimit`, height bounds).
 *
 * @param {Object} deps
 * @param {AppState} deps.appState
 * @param {(eventType: import('../types.js').StateEventType, data?: *) => void} deps.emitStateChange
 * @param {(templateId?: PanelTemplateId) => PanelBlock} deps.createPanelBlock - Closure-bound block builder that increments `panel.nextBlockId`.
 * @param {() => void} deps.ensureDefaultPanelBlock - Inserts a block using the canonical compatibility layout when `panel.blocks` is empty and synchronizes `panel.layout`. Called from every method that reads or writes blocks; this is why several "getter" methods have a side effect.
 * @param {() => void} deps.syncPanelLayout - Mirrors the authoritative first-block template into the compatibility `panel.layout` field.
 * @param {(name: string) => string} deps.sanitizeChartName
 * @param {number} deps.panelBlockLimit
 * @param {number} deps.panelBlockMinHeight
 * @param {number} deps.panelBlockMaxHeight
 */
export function createPanelStateFacade({
	appState,
	emitStateChange,
	createPanelBlock,
	ensureDefaultPanelBlock,
	syncPanelLayout,
	sanitizeChartName,
	panelBlockLimit,
	panelBlockMinHeight,
	panelBlockMaxHeight,
}) {
	const synchronizePanelLayout = typeof syncPanelLayout === 'function'
		? syncPanelLayout
		: () => {
			const firstBlock = appState.panel.blocks[0];
			if (firstBlock) appState.panel.layout = firstBlock.templateId;
		};

	/**
	 * @returns {ChartSnapshot[]} Live reference to the snapshots array. Do not mutate.
	 */
	function getPanelCharts() {
		return appState.panel.charts;
	}

	/**
	 * Append a chart snapshot. Sanitizes `name`, truncates `metaSummary` to
	 * 180 chars, defaults `createdAt` to the current ISO timestamp, and
	 * assigns a monotonic numeric id.
	 *
	 * @param {Partial<ChartSnapshot>} chartSnapshot - Caller-provided snapshot. `id` is assigned here and ignored if passed in.
	 * @returns {number} The newly assigned snapshot id.
	 * @fires STATE_EVENTS.CHART_ADDED
	 */
	function addChartSnapshot(chartSnapshot) {
		const { id, snapshot } = addChartSnapshotToState(appState.panel, chartSnapshot, sanitizeChartName);
		emitStateChange(STATE_EVENTS.CHART_ADDED, { id, snapshot });
		return id;
	}

	/**
	 * Remove a chart snapshot and clean up every reference to it: the
	 * snapshot itself, the legacy `panel.slots` map, and each block's
	 * `slots` map. A well-formed id with no matching snapshot is a no-op.
	 *
	 * @param {number | string} chartId - Non-negative safe integer or decimal-integer DOM string.
	 * @throws {Error} When `chartId` is malformed.
	 * @fires STATE_EVENTS.CHART_REMOVED - Emitted only when a matching snapshot is removed.
	 */
	function removeChartSnapshot(chartId) {
		const normalizedId = removeChartSnapshotFromState(appState, chartId, ensureDefaultPanelBlock);
		if (normalizedId === null) return;
		emitStateChange(STATE_EVENTS.CHART_REMOVED, normalizedId);
	}

	/**
	 * Look up a snapshot by id.
	 *
	 * @param {number | string} chartId
	 * @returns {ChartSnapshot | null} Live reference. `null` when the id is malformed or no snapshot matches.
	 */
	function getChartSnapshot(chartId) {
		return getChartSnapshotFromState(appState.panel, chartId);
	}

	/**
	 * Read the block list.
	 *
	 * **Side effect:** ensures at least one default block exists; this can
	 * mutate `panel.blocks` on first read after a fresh-state hydration and
	 * synchronizes the compatibility `panel.layout` field. Does not emit.
	 *
	 * @returns {PanelBlock[]} Live reference. Do not mutate.
	 */
	function getPanelBlocks() {
		ensureDefaultPanelBlock();
		return appState.panel.blocks;
	}

	/**
	 * Reset the panel: drop all snapshots, drop the legacy slot map, reset
	 * counters, and replace `blocks` with a single fresh `template-2col` block.
	 *
	 * @fires STATE_EVENTS.PANEL_CLEARED
	 */
	function clearPanel() {
		clearPanelState(appState, createPanelBlock);
		emitStateChange(STATE_EVENTS.PANEL_CLEARED);
	}

	/**
	 * Drop any slot assignment that points at a snapshot id which no longer
	 * exists. Scans both the legacy slot map and every block's slot map.
	 * Does not emit, callers do not need a reactive signal because the
	 * cleanup is invisible to downstream renderers.
	 */
	function validatePanelSlots() {
		validatePanelSlotsState(appState, ensureDefaultPanelBlock);
	}

	/**
	 * Append a new block. Capped at `panelBlockLimit` (default 4, see
	 * `appState.js`).
	 *
	 * @param {PanelTemplateId} [templateId='template-2col']
	 * @returns {string | null} New block id, or `null` when the limit was reached.
	 * @throws {Error} When `templateId` is not an exact registry id.
	 * @fires STATE_EVENTS.PANEL_BLOCK_ADDED - Emitted only on success.
	 */
	function addPanelBlock(templateId = 'template-2col') {
		if (!Object.hasOwn(PANEL_LAYOUTS, templateId)) {
			throw new Error(`Invalid panel template: ${templateId}`);
		}
		const block = addPanelBlockState(appState, templateId, ensureDefaultPanelBlock, createPanelBlock, panelBlockLimit);
		if (!block) return null;
		emitStateChange(STATE_EVENTS.PANEL_BLOCK_ADDED, block);
		return block.id;
	}

	/**
	 * Remove a block. If removal would empty the panel, a fresh
	 * `template-2col` block is inserted in its place.
	 *
	 * @param {string} blockId
	 * @fires STATE_EVENTS.PANEL_BLOCK_REMOVED - Only when a matching block is removed.
	 */
	function removePanelBlock(blockId) {
		const removed = removePanelBlockState(appState, blockId, ensureDefaultPanelBlock, createPanelBlock);
		if (!removed) return;
		synchronizePanelLayout();
		emitStateChange(STATE_EVENTS.PANEL_BLOCK_REMOVED, blockId);
	}

	/**
	 * Reorder a block. `targetIndex` is clamped to `[0, blocks.length - 1]`.
	 * No-op (no event) when the block doesn't exist or the bounded target equals
	 * the current index.
	 *
	 * @param {string} blockId
	 * @param {number} targetIndex - Integer; values outside the list are clamped.
	 * @throws {Error} When the block exists and `targetIndex` is not an integer.
	 * @fires STATE_EVENTS.PANEL_BLOCK_MOVED - Payload `targetIndex` is the clamped value, not the raw input.
	 */
	function movePanelBlock(blockId, targetIndex) {
		const boundedTarget = movePanelBlockState(appState, blockId, targetIndex, ensureDefaultPanelBlock);
		if (boundedTarget === null) return;
		synchronizePanelLayout();
		emitStateChange(STATE_EVENTS.PANEL_BLOCK_MOVED, { blockId, targetIndex: boundedTarget });
	}

	/**
	 * Update a block's mutable split proportions. The patch is atomically
	 * validated as a plain object containing only keys supported by the current
	 * template and finite number values; accepted values are clamped to
	 * `[20, 80]`. Missing blocks, empty patches, and unchanged results are no-op.
	 *
	 * @param {string} blockId
	 * @param {Partial<PanelBlockProportions>} partialProportions
	 * @throws {Error} When the block exists and the patch shape, a key, or a value is invalid.
	 * @fires STATE_EVENTS.PANEL_BLOCK_PROPORTIONS_UPDATED - Only when a stored proportion changes.
	 */
	function updatePanelBlockProportions(blockId, partialProportions) {
		const proportions = updatePanelBlockProportionsState(
			appState,
			blockId,
			partialProportions,
			ensureDefaultPanelBlock,
			clampPercentage,
		);
		if (!proportions) return;
		emitStateChange(STATE_EVENTS.PANEL_BLOCK_PROPORTIONS_UPDATED, { blockId, proportions });
	}

	/**
	 * Set a block's pixel height. Value is rounded and clamped to
	 * `[panelBlockMinHeight, panelBlockMaxHeight]` (defaults 220 to 760, see
	 * `appState.js`). Missing blocks and unchanged rounded/clamped values are
	 * no-op.
	 *
	 * @param {string} blockId
	 * @param {number} heightPx
	 * @throws {Error} When the block exists and `heightPx` is not a finite number.
	 * @fires STATE_EVENTS.PANEL_BLOCK_HEIGHT_UPDATED - Payload carries the clamped height, not the raw input.
	 */
	function updatePanelBlockHeight(blockId, heightPx) {
		const nextHeight = updatePanelBlockHeightState(
			appState,
			blockId,
			heightPx,
			ensureDefaultPanelBlock,
			panelBlockMinHeight,
			panelBlockMaxHeight,
		);
		if (nextHeight === null) return;
		emitStateChange(STATE_EVENTS.PANEL_BLOCK_HEIGHT_UPDATED, { blockId, heightPx: nextHeight });
	}

	/**
	 * Toggle and/or recolor a block's border. The optional patch is atomically
	 * validated and accepts only boolean `enabled` and valid hex `color` fields.
	 * Missing blocks, empty patches, and unchanged results are no-op.
	 *
	 * @param {string} blockId
	 * @param {Object} [options]
	 * @param {boolean} [options.enabled]
	 * @param {string} [options.color] - Hex color (e.g. `'#5d645d'`).
	 * @throws {Error} When the block exists and the patch shape or a supplied field is invalid.
	 * @fires STATE_EVENTS.PANEL_BLOCK_BORDER_UPDATED - Only when a stored border value changes.
	 */
	function updatePanelBlockBorder(blockId, options = {}) {
		const nextBorder = updatePanelBlockBorderState(appState, blockId, options, ensureDefaultPanelBlock);
		if (!nextBorder) return;
		emitStateChange(STATE_EVENTS.PANEL_BLOCK_BORDER_UPDATED, {
			blockId,
			enabled: nextBorder.enabled,
			color: nextBorder.color,
		});
	}

	/**
	 * Change a block's layout template. Slots whose id is not part of the
	 * new template are dropped; proportions are reset to the template's
	 * defaults. `panel.layout` remains a compatibility mirror of the first
	 * block's template.
	 *
	 * @param {string} blockId
	 * @param {PanelTemplateId} templateId - Exact registry id.
	 * @returns {boolean} `true` for an existing block, including same-template no-op; `false` when the block was not found.
	 * @throws {Error} When the block exists and `templateId` is not registered.
	 * @fires STATE_EVENTS.PANEL_BLOCK_TEMPLATE_CHANGED - Only when the template changes.
	 */
	function setPanelBlockTemplate(blockId, templateId) {
		const result = setPanelBlockTemplateState(
			appState,
			blockId,
			templateId,
			ensureDefaultPanelBlock,
			getTemplateSlots,
			createDefaultProportions,
		);
		if (!result.ok) return false;
		if (result.changed) {
			synchronizePanelLayout();
			emitStateChange(STATE_EVENTS.PANEL_BLOCK_TEMPLATE_CHANGED, {
				blockId,
				templateId: result.templateId,
			});
		}
		return true;
	}

	/**
	 * Bind a chart snapshot to a block slot. Pass `chartId === null` to
	 * clear the slot.
	 *
	 * @param {string} blockId
	 * @param {string} slotId - e.g. `'slot-1'`.
	 * @param {number | string | null} chartId - Snapshot id, decimal-integer DOM string, or `null` to unassign.
	 * @throws {Error} When the block exists and the slot is unsupported, the chart id is malformed, or no matching snapshot exists.
	 * @fires STATE_EVENTS.PANEL_BLOCK_SLOT_ASSIGNED - Only when the assignment changes; payload `chartId` is `null` or the normalized numeric id.
	 */
	function assignChartToPanelBlockSlot(blockId, slotId, chartId) {
		const result = assignChartToPanelBlockSlotState(
			appState,
			blockId,
			slotId,
			chartId,
			ensureDefaultPanelBlock,
			getChartSnapshot,
		);
		if (!result.ok || !result.changed) return;
		emitStateChange(STATE_EVENTS.PANEL_BLOCK_SLOT_ASSIGNED, { blockId, slotId, chartId: result.normalizedId });
	}

	return {
		getPanelCharts,
		addChartSnapshot,
		removeChartSnapshot,
		getChartSnapshot,
		getPanelBlocks,
		clearPanel,
		validatePanelSlots,
		addPanelBlock,
		removePanelBlock,
		movePanelBlock,
		updatePanelBlockProportions,
		updatePanelBlockHeight,
		updatePanelBlockBorder,
		setPanelBlockTemplate,
		assignChartToPanelBlockSlot,
	};
}
