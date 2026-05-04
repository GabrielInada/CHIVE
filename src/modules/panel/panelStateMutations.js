export function normalizePanelChartId(chartId) {
	const normalized = Number(chartId);
	return Number.isFinite(normalized) ? normalized : null;
}

export function addChartSnapshotToState(panelState, chartSnapshot, sanitizeChartName) {
	const id = panelState.nextChartId++;
	const metaSummary = typeof chartSnapshot.metaSummary === 'string'
		? chartSnapshot.metaSummary.slice(0, 180)
		: '';
	const snapshot = {
		id,
		nome: sanitizeChartName(chartSnapshot.nome),
		type: chartSnapshot.type || null,
		config: chartSnapshot.config || null,
		dataSnapshot: Array.isArray(chartSnapshot.dataSnapshot) ? chartSnapshot.dataSnapshot : [],
		columnsSnapshot: Array.isArray(chartSnapshot.columnsSnapshot) ? chartSnapshot.columnsSnapshot : [],
		metadata: chartSnapshot.metadata || null,
		metaSummary,
		createdAt: chartSnapshot.createdAt || new Date().toISOString(),
	};
	panelState.charts.push(snapshot);
	return { id, snapshot };
}

export function removeChartSnapshotFromState(appState, chartId, ensureDefaultPanelBlock) {
	const normalizedId = normalizePanelChartId(chartId);
	if (normalizedId === null) return null;

	appState.panel.charts = appState.panel.charts.filter(c => c.id !== normalizedId);
	Object.keys(appState.panel.slots).forEach(slotId => {
		if (appState.panel.slots[slotId] === normalizedId) {
			delete appState.panel.slots[slotId];
		}
	});

	ensureDefaultPanelBlock();
	appState.panel.blocks.forEach(block => {
		Object.keys(block.slots).forEach(slotId => {
			if (block.slots[slotId] === normalizedId) {
				delete block.slots[slotId];
			}
		});
	});

	return normalizedId;
}

export function getChartSnapshotFromState(panelState, chartId) {
	const normalizedId = normalizePanelChartId(chartId);
	if (normalizedId === null) return null;
	return panelState.charts.find(c => c.id === normalizedId) || null;
}

export function assignChartToSlotInState(appState, slotId, chartId, getChartSnapshot) {
	if (chartId === null) {
		delete appState.panel.slots[slotId];
		return;
	}

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

export function clearPanelState(appState, createPanelBlock) {
	appState.panel.charts = [];
	appState.panel.slots = {};
	appState.panel.nextBlockId = 1;
	appState.panel.blocks = [createPanelBlock('layout-2col')];
	appState.panel.layout = 'layout-2col';
	appState.panel.nextChartId = 0;
}

export function validatePanelSlotsState(appState, ensureDefaultPanelBlock) {
	const validChartIds = new Set(appState.panel.charts.map(c => c.id));
	Object.keys(appState.panel.slots).forEach(slotId => {
		const chartId = appState.panel.slots[slotId];
		if (!validChartIds.has(chartId)) {
			delete appState.panel.slots[slotId];
		}
	});

	ensureDefaultPanelBlock();
	appState.panel.blocks.forEach(block => {
		Object.keys(block.slots).forEach(slotId => {
			const chartId = block.slots[slotId];
			if (!validChartIds.has(chartId)) {
				delete block.slots[slotId];
			}
		});
	});
}

export function addPanelBlockState(appState, templateId, ensureDefaultPanelBlock, createPanelBlock, panelBlockLimit) {
	ensureDefaultPanelBlock();
	if (appState.panel.blocks.length >= panelBlockLimit) {
		return null;
	}
	const block = createPanelBlock(templateId);
	appState.panel.blocks.push(block);
	return block;
}

export function removePanelBlockState(appState, blockId, ensureDefaultPanelBlock, createPanelBlock) {
	ensureDefaultPanelBlock();
	const nextBlocks = appState.panel.blocks.filter(block => block.id !== blockId);
	appState.panel.blocks = nextBlocks.length > 0 ? nextBlocks : [createPanelBlock('layout-2col')];
}

export function movePanelBlockState(appState, blockId, targetIndex, ensureDefaultPanelBlock) {
	ensureDefaultPanelBlock();
	const currentIndex = appState.panel.blocks.findIndex(block => block.id === blockId);
	if (currentIndex === -1) return null;

	const boundedTarget = Math.max(0, Math.min(Number(targetIndex), appState.panel.blocks.length - 1));
	if (!Number.isFinite(boundedTarget) || boundedTarget === currentIndex) return null;

	const [item] = appState.panel.blocks.splice(currentIndex, 1);
	appState.panel.blocks.splice(boundedTarget, 0, item);
	return boundedTarget;
}

export function updatePanelBlockProportionsState(appState, blockId, partialProportions, ensureDefaultPanelBlock, clampPercentage) {
	ensureDefaultPanelBlock();
	const block = appState.panel.blocks.find(item => item.id === blockId);
	if (!block || !partialProportions || typeof partialProportions !== 'object') return null;

	const next = { ...block.proportions };
	Object.keys(partialProportions).forEach(key => {
		next[key] = clampPercentage(partialProportions[key], 20, 80);
	});
	block.proportions = next;
	return block.proportions;
}

export function updatePanelBlockHeightState(appState, blockId, heightPx, ensureDefaultPanelBlock, minHeight, maxHeight) {
	ensureDefaultPanelBlock();
	const block = appState.panel.blocks.find(item => item.id === blockId);
	if (!block) return null;

	const numeric = Number(heightPx);
	if (!Number.isFinite(numeric)) return null;

	block.heightPx = Math.max(minHeight, Math.min(maxHeight, Math.round(numeric)));
	return block.heightPx;
}

export function updatePanelBlockBorderState(appState, blockId, options, ensureDefaultPanelBlock) {
	ensureDefaultPanelBlock();
	const block = appState.panel.blocks.find(item => item.id === blockId);
	if (!block || !options || typeof options !== 'object') return null;

	if (typeof options.enabled === 'boolean') {
		block.borderEnabled = options.enabled;
	}

	if (typeof options.color === 'string') {
		const color = options.color.trim();
		if (/^#[0-9a-fA-F]{6}$/.test(color)) {
			block.borderColor = color;
		}
	}

	return {
		enabled: block.borderEnabled,
		color: block.borderColor,
	};
}

export function setPanelBlockTemplateState(
	appState,
	blockId,
	templateId,
	ensureDefaultPanelBlock,
	normalizeTemplateId,
	getTemplateSlots,
	createDefaultProportions,
) {
	ensureDefaultPanelBlock();
	const block = appState.panel.blocks.find(item => item.id === blockId);
	if (!block) return { ok: false };

	const normalizedTemplate = normalizeTemplateId(templateId);
	if (block.templateId === normalizedTemplate) {
		return { ok: true, templateId: normalizedTemplate };
	}

	const allowedSlots = new Set(getTemplateSlots(normalizedTemplate));
	const nextSlots = {};
	Object.keys(block.slots).forEach(slotId => {
		if (allowedSlots.has(slotId)) {
			nextSlots[slotId] = block.slots[slotId];
		}
	});

	block.templateId = normalizedTemplate;
	block.proportions = createDefaultProportions(normalizedTemplate);
	block.slots = nextSlots;

	if (appState.panel.blocks[0]?.id === blockId) {
		appState.panel.layout = normalizedTemplate;
	}

	return { ok: true, templateId: normalizedTemplate };
}

export function assignChartToPanelBlockSlotState(
	appState,
	blockId,
	slotId,
	chartId,
	ensureDefaultPanelBlock,
	getChartSnapshot,
) {
	ensureDefaultPanelBlock();
	const block = appState.panel.blocks.find(item => item.id === blockId);
	if (!block) return { ok: false };

	if (chartId === null) {
		delete block.slots[slotId];
		return { ok: true, normalizedId: null };
	}

	const normalizedId = normalizePanelChartId(chartId);
	if (normalizedId === null) {
		throw new Error(`Chart ${chartId} not found`);
	}
	const chart = getChartSnapshot(normalizedId);
	if (!chart) {
		throw new Error(`Chart ${chartId} not found`);
	}

	block.slots[slotId] = normalizedId;
	return { ok: true, normalizedId };
}

export function migrateLegacyPanelStateState(appState, createPanelBlock) {
	const legacyLayout = appState.panel.layout || 'layout-2col';
	const legacySlots = appState.panel.slots || {};

	const firstBlock = createPanelBlock(legacyLayout);
	firstBlock.slots = { ...legacySlots };
	appState.panel.blocks = [firstBlock];
	delete appState.panel.layout;
	return { blockId: firstBlock.id, templateId: firstBlock.templateId };
}
