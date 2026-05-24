/**
 * CHIVE panel state mutators.
 *
 * Pure state-mutation primitives for the panel domain. These functions
 * are facade internals: although they are exported (so `panelStateFacade.js`
 * can import them across the file boundary), they should not be called
 * from outside `panelStateFacade.js`. The facade is the only sanctioned
 * entry point because it owns event emission — calling these directly
 * mutates state without firing the corresponding `STATE_EVENTS.*`.
 *
 * Each function takes `appState` (or its `.panel` slice) plus injected
 * helper functions from `appState.js`. This indirection lets `appState.js`
 * compose its closure-bound helpers (e.g. `createPanelBlock`,
 * `ensureDefaultPanelBlock`) without exposing them as separate exports.
 *
 * @typedef {import('../../types.js').AppState} AppState
 * @typedef {import('../../types.js').AppStatePanel} AppStatePanel
 * @typedef {import('../../types.js').ChartSnapshot} ChartSnapshot
 * @typedef {import('../../types.js').PanelBlock} PanelBlock
 * @typedef {import('../../types.js').PanelTemplateId} PanelTemplateId
 * @typedef {import('../../types.js').PanelBlockBorderOptions} PanelBlockBorderOptions
 * @typedef {import('../../types.js').PanelBlockProportions} PanelBlockProportions
 */

import { isValidHexColor } from '../../utils/colorUtils.js';

/**
 * Coerce a chart id to a finite number. Used at every boundary that
 * accepts an id from the DOM or user input.
 *
 * @param {*} chartId
 * @returns {number | null} Normalized id, or `null` when not finite.
 */
export function normalizePanelChartId(chartId) {
	const normalized = Number(chartId);
	return Number.isFinite(normalized) ? normalized : null;
}

/**
 * Append a new chart snapshot to the panel. Allocates the next monotonic
 * id, sanitizes the name, and stamps `createdAt` when the caller omits
 * it.
 *
 * @param {AppStatePanel} panelState
 * @param {Partial<ChartSnapshot> & { name: string, type: ChartSnapshot['type'] }} chartSnapshot - Pre-snapshot data; fields are normalized into the canonical {@link ChartSnapshot} shape.
 * @param {(name: string) => string} sanitizeChartName - Closure-bound sanitizer from `appState.js`.
 * @returns {{ id: number, snapshot: ChartSnapshot }}
 */
export function addChartSnapshotToState(panelState, chartSnapshot, sanitizeChartName) {
	const id = panelState.nextChartId++;
	const metaSummary = typeof chartSnapshot.metaSummary === 'string'
		? chartSnapshot.metaSummary.slice(0, 180)
		: '';
	const snapshot = {
		id,
		name: sanitizeChartName(chartSnapshot.name),
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

/**
 * Remove a chart snapshot and unbind it from every slot that pointed at it.
 * Includes legacy `appState.panel.slots` and the per-block `block.slots`
 * maps. Ensures the default block exists after cleanup.
 *
 * @param {AppState} appState
 * @param {*} chartId - Coerced via {@link normalizePanelChartId}.
 * @param {() => void} ensureDefaultPanelBlock - Closure-bound from `appState.js`.
 * @returns {number | null} The normalized id when removed; `null` when not found.
 */
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

/**
 * Look up a chart snapshot by id.
 *
 * @param {AppStatePanel} panelState
 * @param {*} chartId
 * @returns {ChartSnapshot | null} Live reference, or `null` when not found.
 */
export function getChartSnapshotFromState(panelState, chartId) {
	const normalizedId = normalizePanelChartId(chartId);
	if (normalizedId === null) return null;
	return panelState.charts.find(c => c.id === normalizedId) || null;
}

/**
 * Reset the panel to a single fresh `template-2col` block, drop all charts,
 * and zero the id counters.
 *
 * @param {AppState} appState
 * @param {(templateId: PanelTemplateId) => PanelBlock} createPanelBlock - Closure-bound block factory from `appState.js`.
 */
export function clearPanelState(appState, createPanelBlock) {
	appState.panel.charts = [];
	appState.panel.slots = {};
	appState.panel.nextBlockId = 1;
	appState.panel.blocks = [createPanelBlock('template-2col')];
	appState.panel.layout = 'template-2col';
	appState.panel.nextChartId = 0;
}

/**
 * Drop slot references that point at chart ids no longer in the panel.
 * Runs over both the legacy panel-level slot map and every per-block slot
 * map. Idempotent.
 *
 * @param {AppState} appState
 * @param {() => void} ensureDefaultPanelBlock
 */
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

/**
 * Append a new block to the panel. Refuses to add when the block count
 * already meets or exceeds `panelBlockLimit` (returns `null` so the
 * facade can emit a warning).
 *
 * @param {AppState} appState
 * @param {PanelTemplateId} templateId
 * @param {() => void} ensureDefaultPanelBlock
 * @param {(templateId: PanelTemplateId) => PanelBlock} createPanelBlock
 * @param {number} panelBlockLimit
 * @returns {PanelBlock | null} The new block, or `null` when the limit was hit.
 */
export function addPanelBlockState(appState, templateId, ensureDefaultPanelBlock, createPanelBlock, panelBlockLimit) {
	ensureDefaultPanelBlock();
	if (appState.panel.blocks.length >= panelBlockLimit) {
		return null;
	}
	const block = createPanelBlock(templateId);
	appState.panel.blocks.push(block);
	return block;
}

/**
 * Remove a block by id. When removal would empty the panel, replaces the
 * removed block with a fresh `template-2col` block so the panel is never
 * blockless.
 *
 * @param {AppState} appState
 * @param {string} blockId
 * @param {() => void} ensureDefaultPanelBlock
 * @param {(templateId: PanelTemplateId) => PanelBlock} createPanelBlock
 */
export function removePanelBlockState(appState, blockId, ensureDefaultPanelBlock, createPanelBlock) {
	ensureDefaultPanelBlock();
	const nextBlocks = appState.panel.blocks.filter(block => block.id !== blockId);
	appState.panel.blocks = nextBlocks.length > 0 ? nextBlocks : [createPanelBlock('template-2col')];
}

/**
 * Reorder blocks by moving `blockId` to `targetIndex`. Clamps the target
 * to the valid range. No-ops when the block is already at the target or
 * does not exist.
 *
 * @param {AppState} appState
 * @param {string} blockId
 * @param {*} targetIndex - Coerced to a finite number; non-finite is rejected.
 * @param {() => void} ensureDefaultPanelBlock
 * @returns {number | null} The resolved target index, or `null` when the move was rejected.
 */
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

/**
 * Merge new proportions into a block, clamping each value to `[20, 80]`.
 * Only the keys present in `partialProportions` are touched.
 *
 * @param {AppState} appState
 * @param {string} blockId
 * @param {Partial<PanelBlockProportions>} partialProportions
 * @param {() => void} ensureDefaultPanelBlock
 * @param {(value: number, min: number, max: number) => number} clampPercentage
 * @returns {PanelBlockProportions | null} The merged proportions, or `null` when the block was not found or `partialProportions` was invalid.
 */
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

/**
 * Set a block's pixel height, clamped to `[minHeight, maxHeight]` and
 * rounded to an integer. Non-finite heights are rejected.
 *
 * @param {AppState} appState
 * @param {string} blockId
 * @param {*} heightPx - Coerced to a finite number; non-finite is rejected.
 * @param {() => void} ensureDefaultPanelBlock
 * @param {number} minHeight
 * @param {number} maxHeight
 * @returns {number | null} The clamped height, or `null` when block not found or input invalid.
 */
export function updatePanelBlockHeightState(appState, blockId, heightPx, ensureDefaultPanelBlock, minHeight, maxHeight) {
	ensureDefaultPanelBlock();
	const block = appState.panel.blocks.find(item => item.id === blockId);
	if (!block) return null;

	const numeric = Number(heightPx);
	if (!Number.isFinite(numeric)) return null;

	block.heightPx = Math.max(minHeight, Math.min(maxHeight, Math.round(numeric)));
	return block.heightPx;
}

/**
 * Update a block's border settings. Only the fields present in `options`
 * are touched. Invalid hex colors are silently dropped (block keeps its
 * previous color).
 *
 * @param {AppState} appState
 * @param {string} blockId
 * @param {PanelBlockBorderOptions} options
 * @param {() => void} ensureDefaultPanelBlock
 * @returns {{ enabled: boolean, color: string } | null} Current border state after the update, or `null` when block not found or `options` invalid.
 */
export function updatePanelBlockBorderState(appState, blockId, options, ensureDefaultPanelBlock) {
	ensureDefaultPanelBlock();
	const block = appState.panel.blocks.find(item => item.id === blockId);
	if (!block || !options || typeof options !== 'object') return null;

	if (typeof options.enabled === 'boolean') {
		block.borderEnabled = options.enabled;
	}

	if (typeof options.color === 'string') {
		const color = options.color.trim();
		if (isValidHexColor(color)) {
			block.borderColor = color;
		}
	}

	return {
		enabled: block.borderEnabled,
		color: block.borderColor,
	};
}

/**
 * Switch a block to a different layout template. Slot assignments that
 * are not present in the new template are dropped silently. When the
 * block being switched is the first block, `appState.panel.layout` is
 * kept in sync.
 *
 * @param {AppState} appState
 * @param {string} blockId
 * @param {*} templateId - Coerced via `normalizeTemplateId`.
 * @param {() => void} ensureDefaultPanelBlock
 * @param {(id: *) => PanelTemplateId} normalizeTemplateId - Closure-bound from `appState.js`.
 * @param {(templateId: PanelTemplateId) => string[]} getTemplateSlots - Returns the slot ids allowed by a template.
 * @param {(templateId: PanelTemplateId) => PanelBlockProportions} createDefaultProportions
 * @returns {{ ok: true, templateId: PanelTemplateId } | { ok: false }}
 */
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

/**
 * Bind (or unbind) a chart snapshot to a specific slot of a block.
 *
 * Passing `chartId === null` clears the slot. Otherwise the chart id is
 * normalized and a lookup is performed via the injected helper; if the
 * chart is missing this function **throws** so callers can route the
 * error through the facade rather than silently swallowing it.
 *
 * @param {AppState} appState
 * @param {string} blockId
 * @param {string} slotId
 * @param {number | null} chartId
 * @param {() => void} ensureDefaultPanelBlock
 * @param {(chartId: number) => ChartSnapshot | null} getChartSnapshot
 * @returns {{ ok: true, normalizedId: number | null } | { ok: false }}
 * @throws {Error} When `chartId` is non-null and resolves to a value, but no chart with that id exists.
 */
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
