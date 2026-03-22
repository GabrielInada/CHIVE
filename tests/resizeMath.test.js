import { describe, it, expect } from 'vitest';
import { clampPercent, normalizeHexColor, computeDynamicMinHeight } from '../src/modules/panel/resizeMath.js';

describe('resizeMath helpers', () => {
	it('clamps percentages to range', () => {
		expect(clampPercent(10)).toBe(20);
		expect(clampPercent(90)).toBe(80);
		expect(clampPercent(50)).toBe(50);
	});

	it('uses min fallback for non-finite values', () => {
		expect(clampPercent('abc')).toBe(20);
		expect(clampPercent(undefined, 5, 10)).toBe(5);
	});

	it('normalizes valid and invalid hex colors', () => {
		expect(normalizeHexColor('#a1B2c3')).toBe('#a1B2c3');
		expect(normalizeHexColor('red')).toBe('#5d645d');
		expect(normalizeHexColor('', '#000000')).toBe('#000000');
	});

	it('computes default dynamic min height for non-vertical templates', () => {
		expect(computeDynamicMinHeight('layout-2col', { split: 50 })).toBe(220);
	});

	it('computes larger min height for extreme layout-1x2 split', () => {
		const minHeight = computeDynamicMinHeight('layout-1x2', { split: 80 });
		expect(minHeight).toBeGreaterThan(220);
		expect(minHeight).toBeLessThanOrEqual(620);
	});

	it('computes larger min height for extreme layout-hero2 splitRight', () => {
		const minHeight = computeDynamicMinHeight('layout-hero2', { splitRight: 80 });
		expect(minHeight).toBeGreaterThan(220);
		expect(minHeight).toBeLessThanOrEqual(620);
	});
});
