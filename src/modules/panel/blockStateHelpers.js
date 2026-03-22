const PANEL_TEMPLATES = ['layout-single', 'layout-2col', 'layout-hero2', 'layout-3col', 'layout-1x2'];

export function createDefaultProportions(templateId) {
	if (templateId === 'layout-2col') return { split: 50 };
	if (templateId === 'layout-hero2') return { splitMain: 60, splitRight: 50 };
	if (templateId === 'layout-3col') return { a: 33, b: 33, c: 34 };
	if (templateId === 'layout-1x2') return { split: 50 };
	return { split: 100 };
}

export function normalizeTemplateId(templateId) {
	return PANEL_TEMPLATES.includes(templateId) ? templateId : 'layout-2col';
}

export function getTemplateSlots(templateId) {
	const normalized = normalizeTemplateId(templateId);
	if (normalized === 'layout-single') return ['slot-1'];
	if (normalized === 'layout-2col') return ['slot-1', 'slot-2'];
	if (normalized === 'layout-hero2') return ['slot-1', 'slot-2', 'slot-3'];
	if (normalized === 'layout-3col') return ['slot-1', 'slot-2', 'slot-3'];
	if (normalized === 'layout-1x2') return ['slot-1', 'slot-2'];
	return ['slot-1', 'slot-2'];
}

export function createPanelBlock(nextBlockId, templateId = 'layout-2col') {
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

export function clampPercentage(value, min = 20, max = 80) {
	const n = Number(value);
	if (!Number.isFinite(n)) return min;
	return Math.max(min, Math.min(max, n));
}
