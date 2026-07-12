import { describe, expect, it } from 'vitest';
import { normalizeScatterOptions } from '../../../src/charts/scatter/options.js';

describe('normalizeScatterOptions', () => {
	it('applies defaults when options are empty', () => {
		const config = normalizeScatterOptions({}, 'colX', 'colY');
		expect(config.radius).toBe(3);
		expect(config.opacity).toBe(0.7);
		expect(config.sizeMode).toBe('uniform');
		expect(config.sizeMin).toBe(2);
		expect(config.sizeMax).toBe(12);
		expect(config.color).toBe('#1a472a');
		expect(config.colorMode).toBe('uniform');
		expect(config.colorScheme).toBe('Bold');
		expect(config.gradientDistribution).toBe('value');
		expect(config.chartHeight).toBe(320);
		expect(config.categoricalPairMode).toBe('jitter');
		expect(config.customTitle).toBe('');
		expect(config.axisLabels).toEqual({ x: 'colX', y: 'colY' });
		expect(config.xFilterColumn).toBeNull();
		expect(config.yFilterColumn).toBeNull();
	});

	it('does not clamp radius or opacity, only falls back when non-finite', () => {
		// Negative/out-of-range finite values are kept verbatim (no range clamp).
		expect(normalizeScatterOptions({ radius: -5, opacity: 99 }, 'x', 'y').radius).toBe(-5);
		expect(normalizeScatterOptions({ radius: -5, opacity: 99 }, 'x', 'y').opacity).toBe(99);
		// Non-finite falls back to the configured default.
		expect(normalizeScatterOptions({ radius: 'nope', opacity: 'nope' }, 'x', 'y').radius).toBe(3);
		expect(normalizeScatterOptions({ radius: 'nope', opacity: 'nope' }, 'x', 'y').opacity).toBe(0.7);
	});

	it('floors sizeMin at 0.5 and sizeMax at sizeMin', () => {
		const config = normalizeScatterOptions({ sizeMin: -10, sizeMax: 2 }, 'x', 'y');
		expect(config.sizeMin).toBe(0.5);
		// sizeMax (2) is above the floored sizeMin (0.5) so it stays.
		expect(config.sizeMax).toBe(2);

		const inverted = normalizeScatterOptions({ sizeMin: 8, sizeMax: 2 }, 'x', 'y');
		expect(inverted.sizeMin).toBe(8);
		expect(inverted.sizeMax).toBe(8);
	});

	it('clamps chartHeight to 220-720 and falls back when non-finite', () => {
		expect(normalizeScatterOptions({ chartHeight: 999 }, 'x', 'y').chartHeight).toBe(720);
		expect(normalizeScatterOptions({ chartHeight: 10 }, 'x', 'y').chartHeight).toBe(220);
		expect(normalizeScatterOptions({ chartHeight: 'nope' }, 'x', 'y').chartHeight).toBe(320);
	});

	it('trims and caps the custom title at 80 chars', () => {
		const config = normalizeScatterOptions({ customTitle: `  ${'a'.repeat(120)}  ` }, 'x', 'y');
		expect(config.customTitle).toHaveLength(80);
		expect(config.customTitle.startsWith('a')).toBe(true);
	});

	it('falls back on invalid colors and palette names, keeps valid ones', () => {
		const bad = normalizeScatterOptions({
			color: 'not-a-color',
			gradientMinColor: 'nope',
			colorScheme: 'missing',
		}, 'x', 'y');
		expect(bad.color).toBe('#1a472a');
		expect(bad.gradientMinColor).toBe('#1a472a'); // falls back to resolved base color
		expect(bad.colorScheme).toBe('Bold');

		const good = normalizeScatterOptions({ color: '#abcdef', colorScheme: 'Pastel' }, 'x', 'y');
		expect(good.color).toBe('#abcdef');
		expect(good.colorScheme).toBe('Pastel');
	});

	it('passes filter columns through from the options bag, not the positional args', () => {
		const config = normalizeScatterOptions({ xColumn: 'gx', yColumn: 'gy' }, 'posX', 'posY');
		expect(config.xFilterColumn).toBe('gx');
		expect(config.yFilterColumn).toBe('gy');

		const nonString = normalizeScatterOptions({ xColumn: 5, yColumn: null }, 'posX', 'posY');
		expect(nonString.xFilterColumn).toBeNull();
		expect(nonString.yFilterColumn).toBeNull();
	});
});
