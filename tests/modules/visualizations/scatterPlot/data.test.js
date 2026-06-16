import { describe, expect, it } from 'vitest';
import { buildScatterPoints } from '../../../../src/modules/visualizations/scatterPlot/data.js';

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
	});
});
