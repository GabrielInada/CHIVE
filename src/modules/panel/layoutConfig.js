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

export function getLayoutConfig(layoutId) {
	return LAYOUTS_PAINEL[layoutId] || LAYOUTS_PAINEL['layout-2col'];
}

export function getTemplateForBlock(block) {
	return getLayoutConfig(block?.templateId);
}
