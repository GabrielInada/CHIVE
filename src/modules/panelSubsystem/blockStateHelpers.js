/**
 * CHIVE panel block primitives.
 *
 * Pure helpers for the panel-block state shape. Reach for these when
 * constructing a fresh block, normalizing untrusted template ids, or
 * deriving the default split for a template. The state-mutation surface
 * lives in `panelStateMutations.js`.
 *
 * Note: a second `createPanelBlock` exists in `domBuilders.js`. That one
 * builds the DOM element; this one builds the state-shape object. Do not
 * cross-import.
 *
 * @typedef {import('../../types.js').PanelBlock} PanelBlock
 * @typedef {import('../../types.js').PanelTemplateId} PanelTemplateId
 * @typedef {import('../../types.js').PanelBlockProportions} PanelBlockProportions
 */

const PANEL_TEMPLATES = ['template-single', 'template-2col', 'template-hero2', 'template-3col', 'template-1x2'];

/**
 * Default proportions for each layout template. The shape varies per
 * template, see {@link PanelBlockProportions} for the union.
 *
 * @param {PanelTemplateId | string} templateId - Unknown ids fall back to a single-column split.
 * @returns {PanelBlockProportions}
 */
export function createDefaultProportions(templateId) {
	if (templateId === 'template-2col') return { split: 50 };
	if (templateId === 'template-hero2') return { splitMain: 60, splitRight: 50 };
	if (templateId === 'template-3col') return { a: 33, b: 33, c: 34 };
	if (templateId === 'template-1x2') return { split: 50 };
	return { split: 100 };
}

/**
 * Coerce an untrusted id into a known {@link PanelTemplateId}. Anything
 * not in the canonical list collapses to `'template-2col'` (the default).
 *
 * @param {*} templateId
 * @returns {PanelTemplateId}
 */
export function normalizeTemplateId(templateId) {
	return PANEL_TEMPLATES.includes(templateId) ? templateId : 'template-2col';
}

/**
 * Slot ids defined by a template. The order in the returned array is the
 * canonical visual order (top-left first).
 *
 * @param {*} templateId
 * @returns {string[]}
 */
export function getTemplateSlots(templateId) {
	const normalized = normalizeTemplateId(templateId);
	if (normalized === 'template-single') return ['slot-1'];
	if (normalized === 'template-2col') return ['slot-1', 'slot-2'];
	if (normalized === 'template-hero2') return ['slot-1', 'slot-2', 'slot-3'];
	if (normalized === 'template-3col') return ['slot-1', 'slot-2', 'slot-3'];
	if (normalized === 'template-1x2') return ['slot-1', 'slot-2'];
	return ['slot-1', 'slot-2'];
}

/**
 * Build a fresh state-shape {@link PanelBlock}. Distinct from the DOM
 * factory `createPanelBlock` in `domBuilders.js`, this one assembles the
 * object that lives in `appState.panel.blocks[]`.
 *
 * @param {number} nextBlockId - Monotonic counter from `appState.panel.nextBlockId`.
 * @param {PanelTemplateId} [templateId='template-2col']
 * @returns {PanelBlock}
 */
export function createPanelBlock(nextBlockId, templateId = 'template-2col') {
	const normalizedTemplate = normalizeTemplateId(templateId);
	return {
		id: `block-${nextBlockId}`,
		templateId: normalizedTemplate,
		slots: {},
		proportions: createDefaultProportions(normalizedTemplate),
		heightPx: null,
		borderEnabled: false,
		borderColor: '#5d645d',
	};
}

/**
 * Clamp a percentage value to `[min, max]` and coerce non-finite inputs
 * to `min`. Used by proportion-mutation paths in {@link panelStateMutations}.
 *
 * @param {*} value
 * @param {number} [min=20]
 * @param {number} [max=80]
 * @returns {number}
 */
export function clampPercentage(value, min = 20, max = 80) {
	const n = Number(value);
	if (!Number.isFinite(n)) return min;
	return Math.max(min, Math.min(max, n));
}
