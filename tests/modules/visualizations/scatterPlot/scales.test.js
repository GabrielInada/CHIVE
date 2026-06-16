import { describe, expect, it } from 'vitest';
import { buildScatterScales } from '../../../../src/modules/visualizations/scatterPlot/scales.js';

function numericPoints() {
	return [
		{ x: 1, y: 10, xCategory: '1', yCategory: '10', index: 0 },
		{ x: 5, y: 50, xCategory: '5', yCategory: '50', index: 1 },
		{ x: 9, y: 90, xCategory: '9', yCategory: '90', index: 2 },
	];
}

function categoricalPoints() {
	return [
		{ x: NaN, y: NaN, xCategory: 'a', yCategory: 'p', index: 0 },
		{ x: NaN, y: NaN, xCategory: 'b', yCategory: 'q', index: 1 },
	];
}

describe('buildScatterScales', () => {
	it('maps numeric axes monotonically with an inverted y', () => {
		const points = numericPoints();
		const { getPointX, getPointY } = buildScatterScales({
			points,
			axisTypes: { x: 'numeric', y: 'numeric' },
			effectiveXScaleType: 'linear',
			effectiveYScaleType: 'linear',
			innerWidth: 200,
			innerHeight: 100,
			shouldAggregateCategoricalPairs: false,
		});

		// Larger x -> larger pixel; larger y -> smaller pixel (SVG y grows downward).
		expect(getPointX(points[2])).toBeGreaterThan(getPointX(points[0]));
		expect(getPointY(points[2])).toBeLessThan(getPointY(points[0]));
		expect(Number.isFinite(getPointX(points[1]))).toBe(true);
	});

	it('places categorical points on the band with no jitter in aggregate mode', () => {
		const points = categoricalPoints();
		const { xScale, getPointX } = buildScatterScales({
			points,
			axisTypes: { x: 'categorical', y: 'categorical' },
			effectiveXScaleType: 'linear',
			effectiveYScaleType: 'linear',
			innerWidth: 200,
			innerHeight: 100,
			shouldAggregateCategoricalPairs: true,
		});

		expect(getPointX(points[0])).toBe(xScale('a'));
		expect(getPointX(points[1])).toBe(xScale('b'));
	});

	it('adds deterministic, bounded jitter for categorical points outside aggregate mode', () => {
		const args = {
			points: categoricalPoints(),
			axisTypes: { x: 'categorical', y: 'categorical' },
			effectiveXScaleType: 'linear',
			effectiveYScaleType: 'linear',
			innerWidth: 200,
			innerHeight: 100,
			shouldAggregateCategoricalPairs: false,
		};
		const first = buildScatterScales(args);
		const second = buildScatterScales(args);
		const point = args.points[0];

		// Jitter is deterministic across renders and stays within the 16px cap.
		expect(first.getPointX(point)).toBe(second.getPointX(point));
		expect(Math.abs(first.getPointX(point) - first.xScale('a'))).toBeLessThanOrEqual(16.5);
	});
});
