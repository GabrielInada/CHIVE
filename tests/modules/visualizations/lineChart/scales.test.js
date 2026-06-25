import { describe, expect, it } from 'vitest';
import { buildXScale } from '../../../../src/modules/visualizations/lineChart/scales.js';
import { AXIS_KIND } from '../../../../src/modules/visualizations/lineChart/data.js';

describe('buildXScale', () => {
	it('builds a numeric scale from the data extent', () => {
		const scale = buildXScale(AXIS_KIND.numeric, [{ x: 1 }, { x: 5 }, { x: 3 }], [0, 100]);
		expect(scale.domain()).toEqual([1, 5]);
		expect(scale.range()).toEqual([0, 100]);
	});

	it('pads a single-point numeric domain by +/-1', () => {
		const scale = buildXScale(AXIS_KIND.numeric, [{ x: 4 }, { x: 4 }], [0, 100]);
		expect(scale.domain()).toEqual([3, 5]);
	});

	it('builds a UTC date scale from the data extent', () => {
		const a = new Date('2024-01-01');
		const b = new Date('2024-03-01');
		const scale = buildXScale(AXIS_KIND.date, [{ x: b }, { x: a }], [0, 100]);
		const domain = scale.domain();
		expect(domain[0].getTime()).toBe(a.getTime());
		expect(domain[1].getTime()).toBe(b.getTime());
	});

	it('builds a categorical point scale over the unique x values in order', () => {
		const scale = buildXScale(AXIS_KIND.categorical, [{ x: 'a' }, { x: 'b' }, { x: 'a' }, { x: 'c' }], [0, 100]);
		expect(scale.domain()).toEqual(['a', 'b', 'c']);
	});
});
