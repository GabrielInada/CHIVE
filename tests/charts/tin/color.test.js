import { describe, expect, it } from 'vitest';
import { createTinColorScale } from '../../../src/charts/tin/color.js';
import { TIN_CHART } from '../../../src/config/charts.js';

const VALUE_BW = {
	colorRamp: 'custom',
	gradientMin: '#000000',
	gradientMax: '#ffffff',
	gradientDistribution: 'value',
	zValues: [0, 5, 10],
	zMin: 0,
	zMax: 10,
};

describe('createTinColorScale sampleRamp', () => {
	it('interpolates the custom two-color gradient and clamps t to [0,1]', () => {
		const { sampleRamp } = createTinColorScale(VALUE_BW);
		expect(sampleRamp(0)).toBe('#000000');
		expect(sampleRamp(0.5)).toBe('#808080');
		// Out-of-range t is clamped, not extrapolated.
		expect(sampleRamp(-1)).toBe(sampleRamp(0));
		expect(sampleRamp(2)).toBe(sampleRamp(1));
	});

	it('uses the named ramp (via the factory) when colorRamp is not custom', () => {
		const custom = createTinColorScale(VALUE_BW).sampleRamp(0.5);
		const viridis = createTinColorScale({ ...VALUE_BW, colorRamp: 'viridis' }).sampleRamp(0.5);
		expect(typeof viridis).toBe('string');
		expect(viridis).not.toBe(custom);
	});
});

describe('createTinColorScale tForZ', () => {
	it('maps Z linearly across the range in value distribution', () => {
		const { tForZ } = createTinColorScale(VALUE_BW);
		expect(tForZ(0)).toBe(0);
		expect(tForZ(5)).toBeCloseTo(0.5, 10);
		expect(tForZ(10)).toBe(1);
	});

	it('maps Z by rank in rank distribution (differs from value on skewed data)', () => {
		const skewed = { ...VALUE_BW, gradientDistribution: 'rank', zValues: [0, 0, 0, 0, 100], zMin: 0, zMax: 100 };
		const rank = createTinColorScale(skewed).tForZ(50);
		const value = createTinColorScale({ ...skewed, gradientDistribution: 'value' }).tForZ(50);
		// Four of five values sit below 50, so rank pushes it to the top of the ramp.
		expect(rank).toBe(1);
		expect(value).toBeCloseTo(0.5, 10);
		expect(rank).not.toBe(value);
	});

	it('does not mutate the caller zValues array when sorting for rank', () => {
		const zValues = [10, 0, 5];
		createTinColorScale({ ...VALUE_BW, gradientDistribution: 'rank', zValues });
		expect(zValues).toEqual([10, 0, 5]);
	});
});

describe('createTinColorScale bucketAt / bucketCount', () => {
	it('exposes the configured bucket count', () => {
		expect(createTinColorScale(VALUE_BW).bucketCount).toBe(TIN_CHART.rampBuckets);
	});

	it('quantizes Z into [0, bucketCount-1]', () => {
		const { bucketAt, bucketCount } = createTinColorScale(VALUE_BW);
		expect(bucketAt(0)).toBe(0);
		expect(bucketAt(10)).toBe(bucketCount - 1);
		// Above-range Z stays clamped to the last bucket.
		expect(bucketAt(999)).toBe(bucketCount - 1);
	});
});
