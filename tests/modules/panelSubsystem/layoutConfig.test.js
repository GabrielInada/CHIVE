import { describe, it, expect } from 'vitest';
import { PANEL_LAYOUTS, getLayoutConfig, getTemplateForBlock } from '../../../src/modules/panelSubsystem/layoutConfig.js';

describe('layoutConfig helpers', () => {
	it('returns expected layout map entries', () => {
		expect(PANEL_LAYOUTS['layout-2col'].slots).toEqual(['slot-1', 'slot-2']);
		expect(PANEL_LAYOUTS['layout-hero2'].slots.length).toBe(3);
	});

	it('returns fallback layout for invalid id', () => {
		const cfg = getLayoutConfig('invalid-layout');
		expect(cfg).toBe(PANEL_LAYOUTS['layout-2col']);
	});

	it('returns block template config through helper', () => {
		const cfg = getTemplateForBlock({ templateId: 'layout-single' });
		expect(cfg.cssClass).toBe('layout-single');
	});

	it('falls back for missing block/template id', () => {
		expect(getTemplateForBlock({}).cssClass).toBe('layout-2col');
		expect(getTemplateForBlock(null).cssClass).toBe('layout-2col');
	});
});
