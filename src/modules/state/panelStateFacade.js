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
} from '../panelSubsystem/panelStateMutations.js';
import {
	clampPercentage,
	createDefaultProportions,
	getTemplateSlots,
	normalizeTemplateId,
} from '../panelSubsystem/blockStateHelpers.js';
import { STATE_EVENTS } from './stateEvents.js';

/**
 * CHIVE panel-domain facade.
 *
 * Owns every write into `appState.panel`. The mutation helpers in
 * `../panelSubsystem/panelStateMutations.js` are `@internal` and must not be
 * imported from outside this module; they assume the caller is the facade and
 * skip event emission.
 *
 * @typedef {import('../../types.js').AppState} AppState
 * @typedef {import('../../types.js').ChartSnapshot} ChartSnapshot
 * @typedef {import('../../types.js').PanelBlock} PanelBlock
 * @typedef {import('../../types.js').PanelTemplateId} PanelTemplateId
 * @typedef {import('../../types.js').PanelBlockProportions} PanelBlockProportions
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
 * @param {(eventType: import('../../types.js').StateEventType, data?: *) => void} deps.emitStateChange
 * @param {(templateId?: PanelTemplateId) => PanelBlock} deps.createPanelBlock - Closure-bound block builder that increments `panel.nextBlockId`.
 * @param {() => void} deps.ensureDefaultPanelBlock - Inserts a default `template-2col` block when `panel.blocks` is empty. Called from every method that reads or writes blocks; this is why several "getter" methods have a side effect.
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
	sanitizeChartName,
	panelBlockLimit,
	panelBlockMinHeight,
	panelBlockMaxHeight,
}) {
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
	 * `slots` map. No-op (no event) when `chartId` cannot be coerced to a
	 * finite number.
	 *
	 * @param {number | string} chartId - Snapshot id; non-numeric strings are silently rejected.
	 * @fires STATE_EVENTS.CHART_REMOVED - Emitted only when removal proceeds.
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
	 * @returns {ChartSnapshot | null} Live reference. `null` when the id is non-numeric or no snapshot matches.
	 */
	function getChartSnapshot(chartId) {
		return getChartSnapshotFromState(appState.panel, chartId);
	}

	/**
	 * Read the block list.
	 *
	 * **Side effect:** ensures at least one default block exists; this can
	 * mutate `panel.blocks` on first read after a fresh-state hydration.
	 * Does not emit.
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
	 * @fires STATE_EVENTS.PANEL_BLOCK_ADDED - Emitted only on success.
	 */
	function addPanelBlock(templateId = 'template-2col') {
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
	 * @fires STATE_EVENTS.PANEL_BLOCK_REMOVED
	 */
	function removePanelBlock(blockId) {
		removePanelBlockState(appState, blockId, ensureDefaultPanelBlock, createPanelBlock);
		emitStateChange(STATE_EVENTS.PANEL_BLOCK_REMOVED, blockId);
	}

	/**
	 * Reorder a block. `targetIndex` is clamped to `[0, blocks.length - 1]`.
	 * No-op (no event) when the block doesn't exist, the target equals the
	 * current index, or `targetIndex` is non-finite.
	 *
	 * @param {string} blockId
	 * @param {number} targetIndex
	 * @fires STATE_EVENTS.PANEL_BLOCK_MOVED - Payload `targetIndex` is the clamped value, not the raw input.
	 */
	function movePanelBlock(blockId, targetIndex) {
		const boundedTarget = movePanelBlockState(appState, blockId, targetIndex, ensureDefaultPanelBlock);
		if (boundedTarget === null) return;
		emitStateChange(STATE_EVENTS.PANEL_BLOCK_MOVED, { blockId, targetIndex: boundedTarget });
	}

	/**
	 * Update a block's split proportions. Each value is clamped to `[20, 80]`.
	 * Partial updates are merged into the existing `proportions`; fields
	 * not in `partialProportions` are preserved. No-op when the block is
	 * missing or `partialProportions` is not an object.
	 *
	 * @param {string} blockId
	 * @param {Partial<PanelBlockProportions>} partialProportions
	 * @fires STATE_EVENTS.PANEL_BLOCK_PROPORTIONS_UPDATED
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
	 * `appState.js`). No-op when the block is missing or `heightPx` is
	 * non-finite.
	 *
	 * @param {string} blockId
	 * @param {number} heightPx
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
	 * Toggle and/or recolor a block's border. Invalid hex colors are
	 * silently ignored; non-boolean `enabled` is silently ignored.
	 *
	 * @param {string} blockId
	 * @param {Object} [options]
	 * @param {boolean} [options.enabled]
	 * @param {string} [options.color] - Hex color (e.g. `'#5d645d'`).
	 * @fires STATE_EVENTS.PANEL_BLOCK_BORDER_UPDATED
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
	 * defaults. If the block is the first one, `panel.layout` is mirrored
	 * to the new template (since `panel.layout` shadows `blocks[0].templateId`).
	 *
	 * @param {string} blockId
	 * @param {PanelTemplateId} templateId - Unknown templates fall back to `'template-2col'`.
	 * @returns {boolean} `true` when the change was applied (including no-op same-template case), `false` when the block was not found.
	 * @fires STATE_EVENTS.PANEL_BLOCK_TEMPLATE_CHANGED
	 */
	function setPanelBlockTemplate(blockId, templateId) {
		const result = setPanelBlockTemplateState(
			appState,
			blockId,
			templateId,
			ensureDefaultPanelBlock,
			normalizeTemplateId,
			getTemplateSlots,
			createDefaultProportions,
		);
		if (!result.ok) return false;

		emitStateChange(STATE_EVENTS.PANEL_BLOCK_TEMPLATE_CHANGED, {
			blockId,
			templateId: result.templateId,
		});
		return true;
	}

	/**
	 * Bind a chart snapshot to a block slot. Pass `chartId === null` to
	 * clear the slot.
	 *
	 * @param {string} blockId
	 * @param {string} slotId - e.g. `'slot-1'`.
	 * @param {number | null} chartId - Snapshot id, or `null` to unassign.
	 * @throws {Error} When `chartId` is not `null` and no matching snapshot exists (or `chartId` is non-numeric).
	 * @fires STATE_EVENTS.PANEL_BLOCK_SLOT_ASSIGNED - Payload `chartId` is `null` for an unassign, otherwise the normalized numeric id.
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
		if (!result.ok) return;
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
