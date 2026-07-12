import { describe, it, expect } from 'vitest';
import { normalizeHexColor, computeDynamicMinHeight } from '../../../../src/features/panel/layout/resizeMath.js';

describe('resizeMath helpers', () => {
	it('normalizes valid and invalid hex colors', () => {
		expect(normalizeHexColor('#a1B2c3')).toBe('#a1B2c3');
		expect(normalizeHexColor('red')).toBe('#5d645d');
		expect(normalizeHexColor('', '#000000')).toBe('#000000');
	});

	it('computes default dynamic min height for non-vertical templates', () => {
		expect(computeDynamicMinHeight('template-2col', { split: 50 })).toBe(220);
	});

	it('computes larger min height for extreme template-1x2 split', () => {
		const minHeight = computeDynamicMinHeight('template-1x2', { split: 80 });
		expect(minHeight).toBeGreaterThan(220);
		expect(minHeight).toBeLessThanOrEqual(620);
	});

	it('computes larger min height for extreme template-hero2 splitRight', () => {
		const minHeight = computeDynamicMinHeight('template-hero2', { splitRight: 80 });
		expect(minHeight).toBeGreaterThan(220);
		expect(minHeight).toBeLessThanOrEqual(620);
	});
});
