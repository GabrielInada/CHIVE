/**
 * CHIVE panel-block model.
 *
 * Pure construction and normalization for the panel-block state shape:
 * the object that lives in `appState.panel.blocks[]`. The state-mutation
 * surface lives in `modules/panelSubsystem/panelStateMutations.js` behind
 * the panel facade; the block DOM builders live in
 * `modules/panelSubsystem/domBuilders.js`.
 *
 * @typedef {import('../../types.js').PanelBlock} PanelBlock
 * @typedef {import('../../types.js').PanelTemplateId} PanelTemplateId
 */

import { createDefaultProportions, normalizeTemplateId } from './layoutTemplates.js';

/**
 * Build a fresh state-shape {@link PanelBlock}. The `Model` suffix keeps
 * it distinct from the DOM builders (`createPanelSlotElement` and
 * friends); this constructor never touches the DOM.
 *
 * @param {number} nextBlockId - Monotonic counter from `appState.panel.nextBlockId`.
 * @param {PanelTemplateId} [templateId='template-2col']
 * @returns {PanelBlock}
 */
export function createPanelBlockModel(nextBlockId, templateId = 'template-2col') {
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
 * to `min`. The one shared clamp for panel proportions: state validation
 * (`panelStateFacade.js`) and resize math (`resizeMath.js`,
 * `panelResize.js`) both use it.
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
