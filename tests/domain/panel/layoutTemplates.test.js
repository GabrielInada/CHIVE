import { describe, it, expect } from 'vitest';
import {
	PANEL_LAYOUTS,
	getLayoutConfig,
	getTemplateForBlock,
	normalizeTemplateId,
	getTemplateSlots,
	createDefaultProportions,
} from '../../../src/domain/panel/layoutTemplates.js';

describe('PANEL_LAYOUTS registry', () => {
	it('returns expected layout map entries', () => {
		expect(PANEL_LAYOUTS['template-2col'].slots).toEqual(['slot-1', 'slot-2']);
		expect(PANEL_LAYOUTS['template-hero2'].slots.length).toBe(3);
	});

	it('defines every field on every template', () => {
		Object.values(PANEL_LAYOUTS).forEach(template => {
			expect(typeof template.cssClass).toBe('string');
			expect(Array.isArray(template.slots)).toBe(true);
			expect(template.slots.length).toBeGreaterThan(0);
			expect(typeof template.defaultProportions).toBe('object');
			expect(typeof template.labelKey).toBe('string');
		});
	});
});

describe('getLayoutConfig', () => {
	it('returns fallback layout for invalid id', () => {
		const cfg = getLayoutConfig('invalid-layout');
		expect(cfg).toBe(PANEL_LAYOUTS['template-2col']);
	});
});

describe('getTemplateForBlock', () => {
	it('returns block template config through helper', () => {
		const cfg = getTemplateForBlock({ templateId: 'template-single' });
		expect(cfg.cssClass).toBe('template-single');
	});

	it('falls back for missing block/template id', () => {
		expect(getTemplateForBlock({}).cssClass).toBe('template-2col');
		expect(getTemplateForBlock(null).cssClass).toBe('template-2col');
	});
});

describe('normalizeTemplateId', () => {
	it('returns valid template ids unchanged', () => {
		expect(normalizeTemplateId('template-single')).toBe('template-single');
		expect(normalizeTemplateId('template-2col')).toBe('template-2col');
		expect(normalizeTemplateId('template-hero2')).toBe('template-hero2');
		expect(normalizeTemplateId('template-3col')).toBe('template-3col');
		expect(normalizeTemplateId('template-1x2')).toBe('template-1x2');
	});

	it('falls back to template-2col for invalid ids', () => {
		expect(normalizeTemplateId('invalid')).toBe('template-2col');
		expect(normalizeTemplateId('')).toBe('template-2col');
		expect(normalizeTemplateId(null)).toBe('template-2col');
	});
});

describe('getTemplateSlots', () => {
	it('returns correct slots for each template', () => {
		expect(getTemplateSlots('template-single')).toEqual(['slot-1']);
		expect(getTemplateSlots('template-2col')).toEqual(['slot-1', 'slot-2']);
		expect(getTemplateSlots('template-hero2')).toEqual(['slot-1', 'slot-2', 'slot-3']);
		expect(getTemplateSlots('template-3col')).toEqual(['slot-1', 'slot-2', 'slot-3']);
		expect(getTemplateSlots('template-1x2')).toEqual(['slot-1', 'slot-2']);
	});

	it('returns default slots for invalid template', () => {
		expect(getTemplateSlots('invalid')).toEqual(['slot-1', 'slot-2']);
	});

	it('returns a fresh array, not the registry reference', () => {
		expect(getTemplateSlots('template-2col')).not.toBe(PANEL_LAYOUTS['template-2col'].slots);
	});
});

describe('createDefaultProportions', () => {
	it('returns correct proportions for each template', () => {
		expect(createDefaultProportions('template-2col')).toEqual({ split: 50 });
		expect(createDefaultProportions('template-hero2')).toEqual({ splitMain: 60, splitRight: 50 });
		expect(createDefaultProportions('template-3col')).toEqual({ a: 33, b: 33, c: 34 });
		expect(createDefaultProportions('template-1x2')).toEqual({ split: 50 });
	});

	it('returns default for template-single or unknown', () => {
		expect(createDefaultProportions('template-single')).toEqual({ split: 100 });
		expect(createDefaultProportions('unknown')).toEqual({ split: 100 });
	});

	it('returns a fresh object, not the registry reference', () => {
		expect(createDefaultProportions('template-2col')).not.toBe(PANEL_LAYOUTS['template-2col'].defaultProportions);
	});
});
