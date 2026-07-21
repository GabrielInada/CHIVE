/**
 * CHIVE panel state mutators.
 *
 * Pure state-mutation primitives for the panel domain. These functions
 * are facade internals: although they are exported (so `panelStateFacade.js`
 * can import them across the file boundary), they should not be called
 * from outside `panelStateFacade.js`. The facade is the only sanctioned
 * entry point because it owns event emission, calling these directly
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
import { PANEL_LAYOUTS } from '../../domain/panel/layoutTemplates.js';

function isPlainObject(value) {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function getMutableProportionKeys(templateId) {
	if (templateId === 'template-single') return [];
	return Object.keys(PANEL_LAYOUTS[templateId]?.defaultProportions || {});
}

/**
 * Normalize a canonical numeric chart id or a decimal-integer string from a
 * DOM drag payload. Signed, fractional, blank, non-finite, and unsafe values
 * are rejected.
 *
 * @param {*} chartId
 * @returns {number | null} Non-negative safe integer, or `null` when invalid.
 */
export function normalizePanelChartId(chartId) {
	if (typeof chartId === 'number') {
		return Number.isSafeInteger(chartId) && chartId >= 0 ? chartId : null;
	}
	if (typeof chartId !== 'string' || !/^\d+$/.test(chartId)) return null;
	const normalized = Number(chartId);
	return Number.isSafeInteger(normalized) ? normalized : null;
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
 * @param {*} chartId - Normalized via {@link normalizePanelChartId}.
 * @param {() => void} ensureDefaultPanelBlock - Closure-bound from `appState.js`.
 * @returns {number | null} The normalized id when removed; `null` when not found.
 * @throws {Error} When `chartId` is malformed.
 */
export function removeChartSnapshotFromState(appState, chartId, ensureDefaultPanelBlock) {
	const normalizedId = normalizePanelChartId(chartId);
	if (normalizedId === null) throw new Error(`Invalid chart id: ${chartId}`);
	const chartIndex = appState.panel.charts.findIndex(chart => chart.id === normalizedId);
	if (chartIndex === -1) return null;

	appState.panel.charts.splice(chartIndex, 1);
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
 * @returns {boolean} Whether a block was removed.
 */
export function removePanelBlockState(appState, blockId, ensureDefaultPanelBlock, createPanelBlock) {
	ensureDefaultPanelBlock();
	const blockIndex = appState.panel.blocks.findIndex(block => block.id === blockId);
	if (blockIndex === -1) return false;
	appState.panel.blocks.splice(blockIndex, 1);
	if (appState.panel.blocks.length === 0) {
		appState.panel.blocks.push(createPanelBlock('template-2col'));
	}
	return true;
}

/**
 * Reorder blocks by moving `blockId` to `targetIndex`. Clamps the target
 * to the valid range. No-ops when the block is already at the target or
 * does not exist.
 *
 * @param {AppState} appState
 * @param {string} blockId
 * @param {number} targetIndex - Integer clamped to the block-list bounds.
 * @param {() => void} ensureDefaultPanelBlock
 * @returns {number | null} The resolved target index, or `null` when the move was rejected.
	 * @throws {Error} When the block exists and `targetIndex` is not an integer.
 */
export function movePanelBlockState(appState, blockId, targetIndex, ensureDefaultPanelBlock) {
	ensureDefaultPanelBlock();
	const currentIndex = appState.panel.blocks.findIndex(block => block.id === blockId);
	if (currentIndex === -1) return null;

	if (!Number.isSafeInteger(targetIndex)) {
		throw new Error(`Invalid panel block target index: ${targetIndex}`);
	}
	const boundedTarget = Math.max(0, Math.min(targetIndex, appState.panel.blocks.length - 1));
	if (boundedTarget === currentIndex) return null;

	const [item] = appState.panel.blocks.splice(currentIndex, 1);
	appState.panel.blocks.splice(boundedTarget, 0, item);
	return boundedTarget;
}

/**
 * Merge validated proportions into a block, clamping each value to `[20, 80]`.
 * Keys are limited to the mutable proportions declared by the block template.
 *
 * @param {AppState} appState
 * @param {string} blockId
 * @param {Partial<PanelBlockProportions>} partialProportions
 * @param {() => void} ensureDefaultPanelBlock
 * @param {(value: number, min: number, max: number) => number} clampPercentage
 * @returns {PanelBlockProportions | null} The merged proportions, or `null` when the block was missing or no stored value changed.
	 * @throws {Error} When the block exists and the patch is not a plain object or contains an unsupported key or non-finite numeric value.
 */
export function updatePanelBlockProportionsState(appState, blockId, partialProportions, ensureDefaultPanelBlock, clampPercentage) {
	ensureDefaultPanelBlock();
	const block = appState.panel.blocks.find(item => item.id === blockId);
	if (!block) return null;
	if (!isPlainObject(partialProportions)) {
		throw new Error('Invalid panel block proportions: expected a plain object');
	}

	const keys = Object.keys(partialProportions);
	if (keys.length === 0) return null;
	const allowedKeys = new Set(getMutableProportionKeys(block.templateId));
	for (const key of keys) {
		if (!allowedKeys.has(key)) {
			throw new Error(`Invalid panel block proportion key: ${key}`);
		}
		if (typeof partialProportions[key] !== 'number' || !Number.isFinite(partialProportions[key])) {
			throw new Error(`Invalid panel block proportion value for ${key}`);
		}
	}

	const next = { ...block.proportions };
	keys.forEach(key => {
		next[key] = clampPercentage(partialProportions[key], 20, 80);
	});
	if (keys.every(key => next[key] === block.proportions[key])) return null;
	block.proportions = next;
	return block.proportions;
}

/**
 * Set a block's pixel height, clamped to `[minHeight, maxHeight]` and
 * rounded to an integer. Only finite number inputs are accepted.
 *
 * @param {AppState} appState
 * @param {string} blockId
 * @param {number} heightPx
 * @param {() => void} ensureDefaultPanelBlock
 * @param {number} minHeight
 * @param {number} maxHeight
 * @returns {number | null} The clamped height, or `null` when the block is missing or the stored value is unchanged.
	 * @throws {Error} When the block exists and `heightPx` is not a finite number.
 */
export function updatePanelBlockHeightState(appState, blockId, heightPx, ensureDefaultPanelBlock, minHeight, maxHeight) {
	ensureDefaultPanelBlock();
	const block = appState.panel.blocks.find(item => item.id === blockId);
	if (!block) return null;

	if (typeof heightPx !== 'number' || !Number.isFinite(heightPx)) {
		throw new Error(`Invalid panel block height: ${heightPx}`);
	}

	const nextHeight = Math.max(minHeight, Math.min(maxHeight, Math.round(heightPx)));
	if (block.heightPx === nextHeight) return null;
	block.heightPx = nextHeight;
	return block.heightPx;
}

/**
 * Update a block's border settings after atomically validating the supplied
 * plain-object patch. Only `enabled` and `color` are supported.
 *
 * @param {AppState} appState
 * @param {string} blockId
 * @param {PanelBlockBorderOptions} options
 * @param {() => void} ensureDefaultPanelBlock
 * @returns {{ enabled: boolean, color: string } | null} Current border state after a change, or `null` when the block is missing or no value changed.
	 * @throws {Error} When the block exists and the patch shape or either supplied field is invalid.
 */
export function updatePanelBlockBorderState(appState, blockId, options, ensureDefaultPanelBlock) {
	ensureDefaultPanelBlock();
	const block = appState.panel.blocks.find(item => item.id === blockId);
	if (!block) return null;
	if (!isPlainObject(options)) {
		throw new Error('Invalid panel block border options: expected a plain object');
	}

	const keys = Object.keys(options);
	if (keys.length === 0) return null;
	for (const key of keys) {
		if (key !== 'enabled' && key !== 'color') {
			throw new Error(`Invalid panel block border option: ${key}`);
		}
	}
	if ('enabled' in options && typeof options.enabled !== 'boolean') {
		throw new Error('Invalid panel block border enabled value');
	}
	let color = block.borderColor;
	if ('color' in options) {
		if (typeof options.color !== 'string' || !isValidHexColor(options.color.trim())) {
			throw new Error('Invalid panel block border color');
		}
		color = options.color.trim();
	}
	const enabled = 'enabled' in options ? options.enabled : block.borderEnabled;
	if (enabled === block.borderEnabled && color === block.borderColor) return null;

	block.borderEnabled = enabled;
	block.borderColor = color;

	return {
		enabled: block.borderEnabled,
		color: block.borderColor,
	};
}

/**
 * Switch a block to a different layout template. Slot assignments that are
 * not present in the new template are dropped. The facade uses the returned
 * `changed` flag to synchronize the compatibility `panel.layout` field and
 * conditionally emit.
 *
 * @param {AppState} appState
 * @param {string} blockId
 * @param {PanelTemplateId} templateId - Exact registry id.
 * @param {() => void} ensureDefaultPanelBlock
 * @param {(templateId: PanelTemplateId) => string[]} getTemplateSlots - Returns the slot ids allowed by a template.
 * @param {(templateId: PanelTemplateId) => PanelBlockProportions} createDefaultProportions
 * @returns {{ ok: true, changed: boolean, templateId: PanelTemplateId } | { ok: false, changed: false }}
	 * @throws {Error} When the block exists and `templateId` is not a registered template.
 */
export function setPanelBlockTemplateState(
	appState,
	blockId,
	templateId,
	ensureDefaultPanelBlock,
	getTemplateSlots,
	createDefaultProportions,
) {
	ensureDefaultPanelBlock();
	const block = appState.panel.blocks.find(item => item.id === blockId);
	if (!block) return { ok: false, changed: false };
	if (!Object.hasOwn(PANEL_LAYOUTS, templateId)) {
		throw new Error(`Invalid panel template: ${templateId}`);
	}

	if (block.templateId === templateId) {
		return { ok: true, changed: false, templateId };
	}

	const allowedSlots = new Set(getTemplateSlots(templateId));
	const nextSlots = {};
	Object.keys(block.slots).forEach(slotId => {
		if (allowedSlots.has(slotId)) {
			nextSlots[slotId] = block.slots[slotId];
		}
	});

	block.templateId = templateId;
	block.proportions = createDefaultProportions(templateId);
	block.slots = nextSlots;

	return { ok: true, changed: true, templateId };
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
 * @param {number | string | null} chartId
 * @param {() => void} ensureDefaultPanelBlock
 * @param {(chartId: number) => ChartSnapshot | null} getChartSnapshot
 * @returns {{ ok: true, changed: boolean, normalizedId: number | null } | { ok: false, changed: false }}
	 * @throws {Error} When the block exists and the slot is unsupported, `chartId` is malformed, or no matching chart exists.
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
	if (!block) return { ok: false, changed: false };
	if (typeof slotId !== 'string' || !PANEL_LAYOUTS[block.templateId]?.slots.includes(slotId)) {
		throw new Error(`Invalid panel slot: ${slotId}`);
	}

	if (chartId === null) {
		if (!Object.hasOwn(block.slots, slotId)) {
			return { ok: true, changed: false, normalizedId: null };
		}
		delete block.slots[slotId];
		return { ok: true, changed: true, normalizedId: null };
	}

	const normalizedId = normalizePanelChartId(chartId);
	if (normalizedId === null) {
		throw new Error(`Invalid chart id: ${chartId}`);
	}
	const chart = getChartSnapshot(normalizedId);
	if (!chart) {
		throw new Error(`Chart ${chartId} not found`);
	}

	if (block.slots[slotId] === normalizedId) {
		return { ok: true, changed: false, normalizedId };
	}
	block.slots[slotId] = normalizedId;
	return { ok: true, changed: true, normalizedId };
}
