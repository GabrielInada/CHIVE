import { describe, it, expect } from 'vitest';
import {
	createPanelBlockModel,
	clampPercentage,
} from '../../../src/domain/panel/panelBlockModel.js';

describe('createPanelBlockModel', () => {
	it('creates block with expected structure', () => {
		const block = createPanelBlockModel(1, 'template-2col');
		expect(block.id).toBe('block-1');
		expect(block.templateId).toBe('template-2col');
		expect(block.slots).toEqual({});
		expect(block.proportions).toEqual({ split: 50 });
		expect(block.heightPx).toBeNull();
		expect(block.borderEnabled).toBe(false);
		expect(block.borderColor).toBe('#5d645d');
	});

	it('normalizes invalid template id', () => {
		const block = createPanelBlockModel(2, 'invalid');
		expect(block.templateId).toBe('template-2col');
	});

	it('defaults to template-2col when no template provided', () => {
		const block = createPanelBlockModel(3);
		expect(block.templateId).toBe('template-2col');
	});

	it('sets correct proportions for each template', () => {
		expect(createPanelBlockModel(1, 'template-hero2').proportions).toEqual({ splitMain: 60, splitRight: 50 });
		expect(createPanelBlockModel(1, 'template-3col').proportions).toEqual({ a: 33, b: 33, c: 34 });
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
		expect(clampPercentage(undefined, 5, 10)).toBe(5);
	});

	it('uses default min/max when not specified', () => {
		expect(clampPercentage(10)).toBe(20);
		expect(clampPercentage(90)).toBe(80);
	});
});
