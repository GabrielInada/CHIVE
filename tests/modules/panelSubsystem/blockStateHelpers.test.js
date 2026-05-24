import { describe, it, expect } from 'vitest';
import {
	createDefaultProportions,
	normalizeTemplateId,
	getTemplateSlots,
	createPanelBlock,
	clampPercentage,
} from '../../../src/modules/panelSubsystem/blockStateHelpers.js';

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
});

describe('createPanelBlock', () => {
	it('creates block with expected structure', () => {
		const block = createPanelBlock(1, 'template-2col');
		expect(block.id).toBe('block-1');
		expect(block.templateId).toBe('template-2col');
		expect(block.slots).toEqual({});
		expect(block.proportions).toEqual({ split: 50 });
		expect(block.heightPx).toBeNull();
		expect(block.borderEnabled).toBe(false);
		expect(block.borderColor).toBe('#5d645d');
	});

	it('normalizes invalid template id', () => {
		const block = createPanelBlock(2, 'invalid');
		expect(block.templateId).toBe('template-2col');
	});

	it('defaults to template-2col when no template provided', () => {
		const block = createPanelBlock(3);
		expect(block.templateId).toBe('template-2col');
	});

	it('sets correct proportions for each template', () => {
		expect(createPanelBlock(1, 'template-hero2').proportions).toEqual({ splitMain: 60, splitRight: 50 });
		expect(createPanelBlock(1, 'template-3col').proportions).toEqual({ a: 33, b: 33, c: 34 });
	});
});

describe('clampPercentage', () => {
	it('clamps value within range', () => {
		expect(clampPercentage(50, 20, 80)).toBe(50);
		expect(clampPercentage(10, 20, 80)).toBe(20);
		expect(clampPercentage(90, 20, 80)).toBe(80);
	});

	it('returns min for non-finite values', () => {
		expect(clampPercentage('abc', 20, 80)).toBe(20);
		expect(clampPercentage(NaN, 20, 80)).toBe(20);
		expect(clampPercentage(undefined, 20, 80)).toBe(20);
	});

	it('uses default min/max when not specified', () => {
		expect(clampPercentage(10)).toBe(20);
		expect(clampPercentage(90)).toBe(80);
	});
});
