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
		emitStateChange('chartAdded', { id, snapshot });
		return id;
	}

	function removeChartSnapshot(chartId) {
		const normalizedId = removeChartSnapshotFromState(appState, chartId, ensureDefaultPanelBlock);
		if (normalizedId === null) return;
		emitStateChange('chartRemoved', normalizedId);
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
		emitStateChange('slotAssigned', { slotId, chartId });
	}

	function getPanelLayout() {
		return appState.panel.layout;
	}

	function setPanelLayout(layoutId) {
		appState.panel.layout = layoutId;
		emitStateChange('layoutChanged', layoutId);
	}

	function clearPanel() {
		clearPanelState(appState, createPanelBlock);
		emitStateChange('panelCleared');
	}

	function validatePanelSlots() {
		validatePanelSlotsState(appState, ensureDefaultPanelBlock);
	}

	function addPanelBlock(templateId = 'layout-2col') {
		const block = addPanelBlockState(appState, templateId, ensureDefaultPanelBlock, createPanelBlock, panelBlockLimit);
		if (!block) return null;
		emitStateChange('panelBlockAdded', block);
		return block.id;
	}

	function removePanelBlock(blockId) {
		removePanelBlockState(appState, blockId, ensureDefaultPanelBlock, createPanelBlock);
		emitStateChange('panelBlockRemoved', blockId);
	}

	function movePanelBlock(blockId, targetIndex) {
		const boundedTarget = movePanelBlockState(appState, blockId, targetIndex, ensureDefaultPanelBlock);
		if (boundedTarget === null) return;
		emitStateChange('panelBlockMoved', { blockId, targetIndex: boundedTarget });
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
		emitStateChange('panelBlockProportionsUpdated', { blockId, proportions });
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
		emitStateChange('panelBlockHeightUpdated', { blockId, heightPx: nextHeight });
	}

	function updatePanelBlockBorder(blockId, options = {}) {
		const nextBorder = updatePanelBlockBorderState(appState, blockId, options, ensureDefaultPanelBlock);
		if (!nextBorder) return;
		emitStateChange('panelBlockBorderUpdated', {
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

		emitStateChange('panelBlockTemplateChanged', {
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
		emitStateChange('panelBlockSlotAssigned', { blockId, slotId, chartId: result.normalizedId });
	}

	function migrateLegacyPanelState() {
		const migration = migrateLegacyPanelStateState(appState, createPanelBlock);
		emitStateChange('panelMigratedToBlocks', migration);
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
