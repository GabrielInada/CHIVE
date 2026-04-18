import { describe, it, expect } from 'vitest';
import {
	createDefaultProportions,
	normalizeTemplateId,
	getTemplateSlots,
	createPanelBlock,
	clampPercentage,
} from '../../../src/modules/panel/blockStateHelpers.js';

describe('createDefaultProportions', () => {
	it('returns correct proportions for each template', () => {
		expect(createDefaultProportions('layout-2col')).toEqual({ split: 50 });
		expect(createDefaultProportions('layout-hero2')).toEqual({ splitMain: 60, splitRight: 50 });
		expect(createDefaultProportions('layout-3col')).toEqual({ a: 33, b: 33, c: 34 });
		expect(createDefaultProportions('layout-1x2')).toEqual({ split: 50 });
	});

	it('returns default for layout-single or unknown', () => {
		expect(createDefaultProportions('layout-single')).toEqual({ split: 100 });
		expect(createDefaultProportions('unknown')).toEqual({ split: 100 });
	});
});

describe('normalizeTemplateId', () => {
	it('returns valid template ids unchanged', () => {
		expect(normalizeTemplateId('layout-single')).toBe('layout-single');
		expect(normalizeTemplateId('layout-2col')).toBe('layout-2col');
		expect(normalizeTemplateId('layout-hero2')).toBe('layout-hero2');
		expect(normalizeTemplateId('layout-3col')).toBe('layout-3col');
		expect(normalizeTemplateId('layout-1x2')).toBe('layout-1x2');
	});

	it('falls back to layout-2col for invalid ids', () => {
		expect(normalizeTemplateId('invalid')).toBe('layout-2col');
		expect(normalizeTemplateId('')).toBe('layout-2col');
		expect(normalizeTemplateId(null)).toBe('layout-2col');
	});
});

describe('getTemplateSlots', () => {
	it('returns correct slots for each template', () => {
		expect(getTemplateSlots('layout-single')).toEqual(['slot-1']);
		expect(getTemplateSlots('layout-2col')).toEqual(['slot-1', 'slot-2']);
		expect(getTemplateSlots('layout-hero2')).toEqual(['slot-1', 'slot-2', 'slot-3']);
		expect(getTemplateSlots('layout-3col')).toEqual(['slot-1', 'slot-2', 'slot-3']);
		expect(getTemplateSlots('layout-1x2')).toEqual(['slot-1', 'slot-2']);
	});

	it('returns default slots for invalid template', () => {
		expect(getTemplateSlots('invalid')).toEqual(['slot-1', 'slot-2']);
	});
});

describe('createPanelBlock', () => {
	it('creates block with expected structure', () => {
		const block = createPanelBlock(1, 'layout-2col');
		expect(block.id).toBe('block-1');
		expect(block.templateId).toBe('layout-2col');
		expect(block.slots).toEqual({});
		expect(block.proportions).toEqual({ split: 50 });
		expect(block.heightPx).toBeNull();
		expect(block.borderEnabled).toBe(false);
		expect(block.borderColor).toBe('#5d645d');
	});

	it('normalizes invalid template id', () => {
		const block = createPanelBlock(2, 'invalid');
		expect(block.templateId).toBe('layout-2col');
	});

	it('defaults to layout-2col when no template provided', () => {
		const block = createPanelBlock(3);
		expect(block.templateId).toBe('layout-2col');
	});

	it('sets correct proportions for each template', () => {
		expect(createPanelBlock(1, 'layout-hero2').proportions).toEqual({ splitMain: 60, splitRight: 50 });
		expect(createPanelBlock(1, 'layout-3col').proportions).toEqual({ a: 33, b: 33, c: 34 });
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
