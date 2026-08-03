import { describe, expect, it } from 'vitest';
import { buildScatterPoints } from '../../../src/charts/scatter/data.js';

const baseArgs = {
	xColumn: 'x',
	yColumn: 'y',
	xScaleType: 'linear',
	yScaleType: 'linear',
	categoricalPairMode: 'jitter',
	configuredAxisTypes: {},
};

describe('buildScatterPoints', () => {
	it('classifies numeric axes and keeps one point per finite row', () => {
		const rows = [{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 }];
		const result = buildScatterPoints({ ...baseArgs, rows });
		expect(result.axisTypes).toEqual({ x: 'numeric', y: 'numeric' });
		expect(result.effectiveXScaleType).toBe('linear');
		expect(result.points).toHaveLength(3);
		expect(result.renderedPoints).toBe(result.points);
		expect(result.sampled).toBe(false);
		expect(result.shouldAggregateCategoricalPairs).toBe(false);
	});

	it('drops non-finite points on numeric axes', () => {
		const rows = [{ x: 1, y: 2 }, { x: 'nope', y: 4 }, { x: 3, y: 'nope' }];
		const result = buildScatterPoints({
			...baseArgs,
			rows,
			configuredAxisTypes: { x: 'number', y: 'number' },
		});
		expect(result.points).toHaveLength(1);
		expect(result.points[0].x).toBe(1);
	});

	it.each([
		['null', null],
		['empty string', ''],
		['whitespace', '   '],
	])('drops a %s coordinate rather than plotting it at the origin', (_label, missing) => {
		const rows = [{ x: 10, y: 20 }, { x: missing, y: 20 }, { x: 10, y: missing }];
		const result = buildScatterPoints({
			...baseArgs,
			rows,
			configuredAxisTypes: { x: 'number', y: 'number' },
		});
		expect(result.points).toHaveLength(1);
		expect(result.points[0]).toMatchObject({ x: 10, y: 20 });
	});

	it('honors explicit configured axis types', () => {
		const rows = [{ x: 1, y: 2 }, { x: 2, y: 4 }];
		const result = buildScatterPoints({
			...baseArgs,
			rows,
			configuredAxisTypes: { x: 'text', y: 'number' },
		});
		expect(result.axisTypes).toEqual({ x: 'categorical', y: 'numeric' });
	});

	it('drops non-positive points and keeps the log effective scale type on a log axis', () => {
		const rows = [{ x: 1, y: 1 }, { x: 2, y: 0 }, { x: 3, y: -5 }, { x: 4, y: 4 }];
		const result = buildScatterPoints({ ...baseArgs, rows, yScaleType: 'log' });
		expect(result.effectiveYScaleType).toBe('log');
		expect(result.points.map(point => point.y)).toEqual([1, 4]);
	});

	it('aggregates repeated categorical pairs only in aggregate mode', () => {
		const rows = [{ x: 'a', y: 'p' }, { x: 'a', y: 'p' }, { x: 'b', y: 'q' }];

		const aggregated = buildScatterPoints({
			...baseArgs,
			rows,
			categoricalPairMode: 'aggregate',
			configuredAxisTypes: { x: 'text', y: 'text' },
		});
		expect(aggregated.shouldAggregateCategoricalPairs).toBe(true);
		expect(aggregated.points).toHaveLength(2);
		expect(aggregated.points[0].isAggregate).toBe(true);
		expect(aggregated.points[0].count).toBe(2);

		const jittered = buildScatterPoints({
			...baseArgs,
			rows,
			categoricalPairMode: 'jitter',
			configuredAxisTypes: { x: 'text', y: 'text' },
		});
		expect(jittered.shouldAggregateCategoricalPairs).toBe(false);
		expect(jittered.points).toHaveLength(3);
	});

	it('returns an empty point set when nothing survives filtering', () => {
		const rows = [{ x: 'nope', y: 'nope' }];
		const result = buildScatterPoints({
			...baseArgs,
			rows,
			configuredAxisTypes: { x: 'number', y: 'number' },
		});
		expect(result.points).toHaveLength(0);
		expect(result.renderedPoints).toHaveLength(0);
		expect(result.validCount).toBe(0);
	});

	it('samples only geometry while retaining the full analysis point set and extrema', () => {
		const rows = Array.from({ length: 20 }, (_, index) => ({
			x: index === 7 ? -100 : index === 13 ? 100 : index,
			y: 20 - index,
		}));
		const result = buildScatterPoints({
			...baseArgs,
			rows,
			maxPoints: 5,
		});

		expect(result.points).toHaveLength(20);
		expect(result.renderedPoints).toHaveLength(5);
		expect(result.renderedCount).toBe(5);
		expect(result.validCount).toBe(20);
		expect(result.totalCount).toBe(20);
		expect(result.sampled).toBe(true);
		expect(result.renderedPoints.some(point => point.x === -100)).toBe(true);
		expect(result.renderedPoints.some(point => point.x === 100)).toBe(true);
	});

	it('bypasses sampling only when the caller has explicit full-render approval', () => {
		const rows = Array.from({ length: 8 }, (_, index) => ({ x: index, y: index }));
		const result = buildScatterPoints({
			...baseArgs,
			rows,
			maxPoints: 3,
			renderAll: true,
		});

		expect(result.renderedPoints).toBe(result.points);
		expect(result.renderedCount).toBe(8);
		expect(result.sampled).toBe(false);
	});
});
