import { describe, expect, it } from 'vitest';
import { normalizeScatterOptions } from '../../../src/charts/scatter/options.js';

describe('normalizeScatterOptions', () => {
	it('applies non-enumerated defaults when config is empty', () => {
		const config = normalizeScatterOptions({});
		expect(config.radius).toBe(3);
		expect(config.opacity).toBe(0.7);
		expect(config.sizeMode).toBeUndefined();
		expect(config.sizeMin).toBe(2);
		expect(config.sizeMax).toBe(12);
		expect(config.color).toBe('#1a472a');
		expect(config.colorMode).toBeUndefined();
		expect(config.colorScheme).toBeUndefined();
		expect(config.gradientDistribution).toBeUndefined();
		expect(config.chartHeight).toBe(320);
		expect(config.categoricalPairMode).toBeUndefined();
		expect(config.customTitle).toBe('');
	});

	it('does not clamp radius or opacity, only falls back when non-finite', () => {
		// Negative/out-of-range finite values are kept verbatim (no range clamp).
		expect(normalizeScatterOptions({ radius: -5, opacity: 99 }).radius).toBe(-5);
		expect(normalizeScatterOptions({ radius: -5, opacity: 99 }).opacity).toBe(99);
		// Non-finite falls back to the configured default.
		expect(normalizeScatterOptions({ radius: 'nope', opacity: 'nope' }).radius).toBe(3);
		expect(normalizeScatterOptions({ radius: 'nope', opacity: 'nope' }).opacity).toBe(0.7);
	});

	it('floors sizeMin at 0.5 and sizeMax at sizeMin', () => {
		const config = normalizeScatterOptions({ sizeMin: -10, sizeMax: 2 });
		expect(config.sizeMin).toBe(0.5);
		// sizeMax (2) is above the floored sizeMin (0.5) so it stays.
		expect(config.sizeMax).toBe(2);

		const inverted = normalizeScatterOptions({ sizeMin: 8, sizeMax: 2 });
		expect(inverted.sizeMin).toBe(8);
		expect(inverted.sizeMax).toBe(8);
	});

	it('clamps chartHeight to 220-720 and falls back when non-finite', () => {
		expect(normalizeScatterOptions({ chartHeight: 999 }).chartHeight).toBe(720);
		expect(normalizeScatterOptions({ chartHeight: 10 }).chartHeight).toBe(220);
		expect(normalizeScatterOptions({ chartHeight: 'nope' }).chartHeight).toBe(320);
	});

	it('trims and caps the custom title at 80 chars', () => {
		const config = normalizeScatterOptions({ customTitle: `  ${'a'.repeat(120)}  ` });
		expect(config.customTitle).toHaveLength(80);
		expect(config.customTitle.startsWith('a')).toBe(true);
	});

	// Chart config canonicalization checks these settings before rendering.
	it.each([
		['xScale', 'xScaleType', 'log'],
		['yScale', 'yScaleType', 'log'],
		['sizeMode', 'sizeMode', 'numeric'],
		['colorMode', 'colorMode', 'category'],
		['colorScheme', 'colorScheme', 'Pastel'],
		['gradientDistribution', 'gradientDistribution', 'rank'],
		['categoricalPairMode', 'categoricalPairMode', 'aggregate'],
	])('reads %s as given', (key, output, value) => {
		expect(normalizeScatterOptions({ [key]: value })[output]).toBe(value);
		expect(normalizeScatterOptions({})[output]).toBeUndefined();
	});

	it('falls back on invalid colors and reads palette names as given', () => {
		const bad = normalizeScatterOptions({
			color: 'not-a-color',
			gradientMinColor: 'nope',
			colorScheme: 'missing',
		});
		expect(bad.color).toBe('#1a472a');
		expect(bad.gradientMinColor).toBe('#1a472a'); // falls back to resolved base color
		expect(bad.colorScheme).toBe('missing');

		const good = normalizeScatterOptions({ color: '#abcdef', colorScheme: 'Pastel' });
		expect(good.color).toBe('#abcdef');
		expect(good.colorScheme).toBe('Pastel');
	});
});
