/**
 * CHIVE panel layout-template registry.
 *
 * The canonical registry of panel layout templates. Each entry maps a
 * {@link PanelTemplateId} to its CSS class, slot list, default
 * proportions, and i18n label key. This is the single source of truth
 * for which templates exist and what they define; panel code imports
 * this module directly rather than maintaining a parallel list.
 *
 * Pure domain data and lookups: no DOM, state, service, or feature
 * imports.
 *
 * @typedef {import('../../types.js').PanelTemplateId} PanelTemplateId
 * @typedef {import('../../types.js').PanelBlockProportions} PanelBlockProportions
 */

/**
 * @type {Object<PanelTemplateId, { cssClass: string, slots: string[], defaultProportions: PanelBlockProportions, labelKey: string }>}
 */
export const PANEL_LAYOUTS = {
	'template-single': {
		cssClass: 'template-single',
		slots: ['slot-1'],
		defaultProportions: { split: 100 },
		labelKey: 'chive-panel-template-single',
	},
	'template-2col': {
		cssClass: 'template-2col',
		slots: ['slot-1', 'slot-2'],
		defaultProportions: { split: 50 },
		labelKey: 'chive-panel-template-2col',
	},
	'template-hero2': {
		cssClass: 'template-hero2',
		slots: ['slot-1', 'slot-2', 'slot-3'],
		defaultProportions: { splitMain: 60, splitRight: 50 },
		labelKey: 'chive-panel-template-hero2',
	},
	'template-3col': {
		cssClass: 'template-3col',
		slots: ['slot-1', 'slot-2', 'slot-3'],
		defaultProportions: { a: 33, b: 33, c: 34 },
		labelKey: 'chive-panel-template-3col',
	},
	'template-1x2': {
		cssClass: 'template-1x2',
		slots: ['slot-1', 'slot-2'],
		defaultProportions: { split: 50 },
		labelKey: 'chive-panel-template-1x2',
	},
};

const PANEL_TEMPLATE_IDS = Object.keys(PANEL_LAYOUTS);

/**
 * Look up a layout config by id. Unknown ids fall back to `'template-2col'`.
 *
 * @param {*} layoutId
 * @returns {{ cssClass: string, slots: string[], defaultProportions: PanelBlockProportions, labelKey: string }}
 */
export function getLayoutConfig(layoutId) {
	return PANEL_LAYOUTS[layoutId] || PANEL_LAYOUTS['template-2col'];
}

/**
 * Resolve the layout config for a panel block. Convenience wrapper that
 * pulls `block.templateId` and delegates to {@link getLayoutConfig}.
 *
 * @param {{ templateId?: PanelTemplateId } | null | undefined} block
 * @returns {{ cssClass: string, slots: string[], defaultProportions: PanelBlockProportions, labelKey: string }}
 */
export function getTemplateForBlock(block) {
	return getLayoutConfig(block?.templateId);
}

/**
 * Coerce an untrusted id into a known {@link PanelTemplateId}. Anything
 * not in the registry collapses to `'template-2col'` (the default).
 *
 * @param {*} templateId
 * @returns {PanelTemplateId}
 */
export function normalizeTemplateId(templateId) {
	return PANEL_TEMPLATE_IDS.includes(templateId) ? templateId : 'template-2col';
}

/**
 * Slot ids defined by a template, as a fresh array. The order is the
 * canonical visual order (top-left first). Unknown ids fall back to
 * `'template-2col'`.
 *
 * @param {*} templateId
 * @returns {string[]}
 */
export function getTemplateSlots(templateId) {
	return [...getLayoutConfig(templateId).slots];
}

/**
 * Default proportions for a template, as a fresh object. The shape varies
 * per template, see {@link PanelBlockProportions} for the union. Unknown
 * ids fall back to a single-column split.
 *
 * @param {PanelTemplateId | string} templateId
 * @returns {PanelBlockProportions}
 */
export function createDefaultProportions(templateId) {
	const template = PANEL_LAYOUTS[templateId];
	return template ? { ...template.defaultProportions } : { split: 100 };
}
