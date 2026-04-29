import {
	addChartSnapshotToState,
	addPanelBlockState,
	assignChartToPanelBlockSlotState,
	assignChartToSlotInState,
	clearPanelState,
	getChartSnapshotFromState,
	migrateLegacyPanelStateState,
	movePanelBlockState,
	removeChartSnapshotFromState,
	removePanelBlockState,
	setPanelBlockTemplateState,
	updatePanelBlockBorderState,
	updatePanelBlockHeightState,
	updatePanelBlockProportionsState,
	validatePanelSlotsState,
} from './panel/panelStateMutations.js';
import {
	clampPercentage,
	createDefaultProportions,
	getTemplateSlots,
	normalizeTemplateId,
} from './panel/blockStateHelpers.js';
import { STATE_EVENTS } from './stateEvents.js';

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
	function getPanelCharts() {
		return appState.panel.charts;
	}

	function addChartSnapshot(chartSnapshot) {
		const { id, snapshot } = addChartSnapshotToState(appState.panel, chartSnapshot, sanitizeChartName);
		emitStateChange(STATE_EVENTS.CHART_ADDED, { id, snapshot });
		return id;
	}

	function removeChartSnapshot(chartId) {
		const normalizedId = removeChartSnapshotFromState(appState, chartId, ensureDefaultPanelBlock);
		if (normalizedId === null) return;
		emitStateChange(STATE_EVENTS.CHART_REMOVED, normalizedId);
	}

	function getChartSnapshot(chartId) {
		return getChartSnapshotFromState(appState.panel, chartId);
	}

	function getPanelSlots() {
		return appState.panel.slots;
	}

	function getPanelBlocks() {
		ensureDefaultPanelBlock();
		return appState.panel.blocks;
	}

	function assignChartToSlot(slotId, chartId) {
		assignChartToSlotInState(appState, slotId, chartId, getChartSnapshot);
		emitStateChange(STATE_EVENTS.SLOT_ASSIGNED, { slotId, chartId });
	}

	function getPanelLayout() {
		return appState.panel.layout;
	}

	function setPanelLayout(layoutId) {
		appState.panel.layout = layoutId;
		emitStateChange(STATE_EVENTS.LAYOUT_CHANGED, layoutId);
	}

	function clearPanel() {
		clearPanelState(appState, createPanelBlock);
		emitStateChange(STATE_EVENTS.PANEL_CLEARED);
	}

	function validatePanelSlots() {
		validatePanelSlotsState(appState, ensureDefaultPanelBlock);
	}

	function addPanelBlock(templateId = 'layout-2col') {
		const block = addPanelBlockState(appState, templateId, ensureDefaultPanelBlock, createPanelBlock, panelBlockLimit);
		if (!block) return null;
		emitStateChange(STATE_EVENTS.PANEL_BLOCK_ADDED, block);
		return block.id;
	}

	function removePanelBlock(blockId) {
		removePanelBlockState(appState, blockId, ensureDefaultPanelBlock, createPanelBlock);
		emitStateChange(STATE_EVENTS.PANEL_BLOCK_REMOVED, blockId);
	}

	function movePanelBlock(blockId, targetIndex) {
		const boundedTarget = movePanelBlockState(appState, blockId, targetIndex, ensureDefaultPanelBlock);
		if (boundedTarget === null) return;
		emitStateChange(STATE_EVENTS.PANEL_BLOCK_MOVED, { blockId, targetIndex: boundedTarget });
	}

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

	function updatePanelBlockBorder(blockId, options = {}) {
		const nextBorder = updatePanelBlockBorderState(appState, blockId, options, ensureDefaultPanelBlock);
		if (!nextBorder) return;
		emitStateChange(STATE_EVENTS.PANEL_BLOCK_BORDER_UPDATED, {
			blockId,
			enabled: nextBorder.enabled,
			color: nextBorder.color,
		});
	}

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

	function migrateLegacyPanelState() {
		const migration = migrateLegacyPanelStateState(appState, createPanelBlock);
		emitStateChange(STATE_EVENTS.PANEL_MIGRATED_TO_BLOCKS, migration);
	}

	return {
		getPanelCharts,
		addChartSnapshot,
		removeChartSnapshot,
		getChartSnapshot,
		getPanelSlots,
		getPanelBlocks,
		assignChartToSlot,
		getPanelLayout,
		setPanelLayout,
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
		migrateLegacyPanelState,
	};
}
