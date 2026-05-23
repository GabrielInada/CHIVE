/**
 * CHIVE panel layout-template registry.
 *
 * Each entry maps a {@link PanelTemplateId} to its CSS class, slot list,
 * and i18n label key. This is the canonical source of truth for which
 * templates exist — `chartFeatures/index.js` exports it as-is and panel
 * code reaches in here rather than maintaining a parallel list.
 *
 * @typedef {import('../../types.js').PanelTemplateId} PanelTemplateId
 */

/**
 * @type {Object<PanelTemplateId, { classe: string, slots: string[], labelKey: string }>}
 */
export const LAYOUTS_PAINEL = {
	'layout-single': {
		classe: 'layout-single',
		slots: ['slot-1'],
		labelKey: 'chive-panel-layout-single',
	},
	'layout-2col': {
		classe: 'layout-2col',
		slots: ['slot-1', 'slot-2'],
		labelKey: 'chive-panel-layout-2col',
	},
	'layout-hero2': {
		classe: 'layout-hero2',
		slots: ['slot-1', 'slot-2', 'slot-3'],
		labelKey: 'chive-panel-layout-hero2',
	},
	'layout-3col': {
		classe: 'layout-3col',
		slots: ['slot-1', 'slot-2', 'slot-3'],
		labelKey: 'chive-panel-layout-3col',
	},
	'layout-1x2': {
		classe: 'layout-1x2',
		slots: ['slot-1', 'slot-2'],
		labelKey: 'chive-panel-layout-1x2',
	},
};

/**
 * Look up a layout config by id. Unknown ids fall back to `'layout-2col'`.
 *
 * @param {*} layoutId
 * @returns {{ classe: string, slots: string[], labelKey: string }}
 */
export function getLayoutConfig(layoutId) {
	return LAYOUTS_PAINEL[layoutId] || LAYOUTS_PAINEL['layout-2col'];
}

/**
 * Resolve the layout config for a panel block. Convenience wrapper that
 * pulls `block.templateId` and delegates to {@link getLayoutConfig}.
 *
 * @param {{ templateId?: PanelTemplateId } | null | undefined} block
 * @returns {{ classe: string, slots: string[], labelKey: string }}
 */
export function getTemplateForBlock(block) {
	return getLayoutConfig(block?.templateId);
}
