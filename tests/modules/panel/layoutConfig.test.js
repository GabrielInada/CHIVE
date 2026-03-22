import { describe, it, expect } from 'vitest';
import { LAYOUTS_PAINEL, getLayoutConfig, getTemplateForBlock } from '../../../src/modules/panel/layoutConfig.js';

describe('layoutConfig helpers', () => {
	it('returns expected layout map entries', () => {
		expect(LAYOUTS_PAINEL['layout-2col'].slots).toEqual(['slot-1', 'slot-2']);
		expect(LAYOUTS_PAINEL['layout-hero2'].slots.length).toBe(3);
	});

	it('returns fallback layout for invalid id', () => {
		const cfg = getLayoutConfig('invalid-layout');
		expect(cfg).toBe(LAYOUTS_PAINEL['layout-2col']);
	});

	it('returns block template config through helper', () => {
		const cfg = getTemplateForBlock({ templateId: 'layout-single' });
		expect(cfg.classe).toBe('layout-single');
	});

	it('falls back for missing block/template id', () => {
		expect(getTemplateForBlock({}).classe).toBe('layout-2col');
		expect(getTemplateForBlock(null).classe).toBe('layout-2col');
	});
});
