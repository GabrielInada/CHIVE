import { describe, expect, it } from 'vitest';
import {
	hexToRgb,
	rgbToHex,
	interpolateColor,
	parseHexColor,
	buildSliceColor,
	buildRankMap,
} from '../../src/utils/colorUtils.js';

describe('colorUtils basics', () => {
	it('round-trips hex through rgb', () => {
		const rgb = hexToRgb('#ff8040');
		expect(rgb).toEqual({ r: 255, g: 128, b: 64 });
		expect(rgbToHex(rgb.r, rgb.g, rgb.b)).toBe('#FF8040');
	});

	it('interpolates linearly between two colors', () => {
		expect(interpolateColor('#000000', '#ffffff', 0)).toBe('#000000');
		expect(interpolateColor('#000000', '#ffffff', 1)).toBe('#FFFFFF');
		expect(interpolateColor('#000000', '#ffffff', 0.5)).toBe('#808080');
	});

	it('clamps interpolation t outside [0,1]', () => {
		expect(interpolateColor('#000000', '#ffffff', -1)).toBe('#000000');
		expect(interpolateColor('#000000', '#ffffff', 2)).toBe('#FFFFFF');
	});

	it('parses valid hex and rejects invalid', () => {
		expect(parseHexColor('#abcdef')).toEqual({ r: 0xab, g: 0xcd, b: 0xef });
		expect(parseHexColor('not-a-color')).toBeNull();
		expect(parseHexColor('#abc')).toBeNull();
	});

	it('darkens slice color by index', () => {
		const base = '#888888';
		const c0 = buildSliceColor(base, 0, base);
		const c1 = buildSliceColor(base, 1, base);
		expect(c0).not.toBe(c1);
	});
});

describe('buildRankMap', () => {
	it('assigns ascending ranks to ascending values', () => {
		const items = [{ v: 3 }, { v: 1 }, { v: 2 }];
		const map = buildRankMap(items, item => item.v);
		expect(map.get(items[1])).toBe(0); // value 1 -> rank 0
		expect(map.get(items[2])).toBe(1); // value 2 -> rank 1
		expect(map.get(items[0])).toBe(2); // value 3 -> rank 2
	});

	it('breaks ties using original order so all items get distinct ranks', () => {
		const items = [{ v: 5 }, { v: 5 }, { v: 5 }];
		const map = buildRankMap(items, item => item.v);
		expect(map.get(items[0])).toBe(0);
		expect(map.get(items[1])).toBe(1);
		expect(map.get(items[2])).toBe(2);
	});

	it('assigns full-range ranks even when values are very close', () => {
		const items = [{ v: 100 }, { v: 100.001 }, { v: 100.002 }, { v: 100.003 }];
		const map = buildRankMap(items, item => item.v);
		const ranks = items.map(it => map.get(it));
		expect(ranks).toEqual([0, 1, 2, 3]);
	});

	it('skips items with non-finite values', () => {
		const items = [{ v: 1 }, { v: NaN }, { v: 3 }, { v: undefined }];
		const map = buildRankMap(items, item => item.v);
		expect(map.size).toBe(2);
		expect(map.get(items[0])).toBe(0);
		expect(map.get(items[2])).toBe(1);
		expect(map.get(items[1])).toBeUndefined();
		expect(map.get(items[3])).toBeUndefined();
	});

	it('handles empty input', () => {
		const map = buildRankMap([], item => item.v);
		expect(map.size).toBe(0);
	});
});
