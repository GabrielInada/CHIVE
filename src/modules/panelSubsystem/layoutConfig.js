/**
 * CHIVE panel layout-template registry.
 *
 * Each entry maps a {@link PanelTemplateId} to its CSS class, slot list,
 * and i18n label key. This is the canonical source of truth for which
 * templates exist; panel code imports this module directly rather than
 * maintaining a parallel list.
 *
 * @typedef {import('../../types.js').PanelTemplateId} PanelTemplateId
 */

/**
 * @type {Object<PanelTemplateId, { cssClass: string, slots: string[], labelKey: string }>}
 */
export const PANEL_LAYOUTS = {
	'template-single': {
		cssClass: 'template-single',
		slots: ['slot-1'],
		labelKey: 'chive-panel-template-single',
	},
	'template-2col': {
		cssClass: 'template-2col',
		slots: ['slot-1', 'slot-2'],
		labelKey: 'chive-panel-template-2col',
	},
	'template-hero2': {
		cssClass: 'template-hero2',
		slots: ['slot-1', 'slot-2', 'slot-3'],
		labelKey: 'chive-panel-template-hero2',
	},
	'template-3col': {
		cssClass: 'template-3col',
		slots: ['slot-1', 'slot-2', 'slot-3'],
		labelKey: 'chive-panel-template-3col',
	},
	'template-1x2': {
		cssClass: 'template-1x2',
		slots: ['slot-1', 'slot-2'],
		labelKey: 'chive-panel-template-1x2',
	},
};

/**
 * Look up a layout config by id. Unknown ids fall back to `'template-2col'`.
 *
 * @param {*} layoutId
 * @returns {{ cssClass: string, slots: string[], labelKey: string }}
 */
export function getLayoutConfig(layoutId) {
	return PANEL_LAYOUTS[layoutId] || PANEL_LAYOUTS['template-2col'];
}

/**
 * Resolve the layout config for a panel block. Convenience wrapper that
 * pulls `block.templateId` and delegates to {@link getLayoutConfig}.
 *
 * @param {{ templateId?: PanelTemplateId } | null | undefined} block
 * @returns {{ cssClass: string, slots: string[], labelKey: string }}
 */
export function getTemplateForBlock(block) {
	return getLayoutConfig(block?.templateId);
}
