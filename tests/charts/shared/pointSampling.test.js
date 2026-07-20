import { describe, expect, it } from 'vitest';
import { sampleWithExtrema } from '../../../src/charts/shared/pointSampling.js';

describe('sampleWithExtrema', () => {
	it('returns the original array when it is within budget', () => {
		const points = [{ x: 1 }, { x: 2 }];
		expect(sampleWithExtrema(points, 2, [point => point.x])).toBe(points);
	});

	it('spans the input, preserves extrema, and emits unique source entries', () => {
		const points = Array.from({ length: 100 }, (_, index) => ({
			index,
			x: index === 37 ? -1000 : index === 61 ? 1000 : index,
		}));

		const sample = sampleWithExtrema(points, 12, [point => point.x]);
		const indexes = sample.map(point => point.index);

		expect(sample).toHaveLength(12);
		expect(indexes).toContain(37);
		expect(indexes).toContain(61);
		expect(Math.min(...indexes)).toBeLessThan(15);
		expect(Math.max(...indexes)).toBeGreaterThan(85);
		expect(new Set(indexes).size).toBe(indexes.length);
		expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
	});

	it('handles empty and zero-budget inputs', () => {
		expect(sampleWithExtrema([], 10)).toEqual([]);
		expect(sampleWithExtrema([1, 2, 3], 0)).toEqual([]);
	});
});
