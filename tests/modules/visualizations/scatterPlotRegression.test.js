import { describe, expect, it } from 'vitest';
import {
	T_CRIT_95,
	tCrit95,
	fitLinearRegression,
	computeRegression,
	formatRegressionEquation,
	formatR2,
} from '../../../src/modules/visualizations/scatterPlotRegression.js';

describe('tCrit95', () => {
	it('returns the lookup-table value for df in [1, 30]', () => {
		expect(tCrit95(1)).toBe(T_CRIT_95[1]);
		expect(tCrit95(5)).toBe(2.571);
		expect(tCrit95(30)).toBe(2.042);
	});

	it('falls back to z = 1.96 for df > 30', () => {
		expect(tCrit95(31)).toBe(1.96);
		expect(tCrit95(1000)).toBe(1.96);
	});

	it('returns NaN for invalid df', () => {
		expect(tCrit95(0)).toBeNaN();
		expect(tCrit95(-1)).toBeNaN();
		expect(tCrit95(NaN)).toBeNaN();
	});
});

describe('fitLinearRegression', () => {
	it('recovers slope=2, intercept=1, r2=1 on exact y = 2x + 1', () => {
		const pairs = [
			{ x: 0, y: 1 },
			{ x: 1, y: 3 },
			{ x: 2, y: 5 },
			{ x: 3, y: 7 },
		];
		const result = fitLinearRegression(pairs);
		expect(result.ok).toBe(true);
		expect(result.slope).toBeCloseTo(2, 10);
		expect(result.intercept).toBeCloseTo(1, 10);
		expect(result.r2).toBeCloseTo(1, 10);
		expect(result.n).toBe(4);
	});

	it('returns r2 < 1 with noise and reasonable slope', () => {
		const pairs = [
			{ x: 0, y: 1 },
			{ x: 1, y: 2.9 },
			{ x: 2, y: 5.2 },
			{ x: 3, y: 6.8 },
		];
		const result = fitLinearRegression(pairs);
		expect(result.ok).toBe(true);
		expect(result.slope).toBeCloseTo(2, 0);
		expect(result.r2).toBeGreaterThan(0.99);
		expect(result.r2).toBeLessThan(1);
	});

	it('reports too-few-points when n < 2', () => {
		expect(fitLinearRegression([])).toEqual({ ok: false, reason: 'too-few-points' });
		expect(fitLinearRegression([{ x: 1, y: 2 }])).toEqual({
			ok: false,
			reason: 'too-few-points',
		});
	});

	it('reports zero-variance when all x values are identical', () => {
		const pairs = [
			{ x: 5, y: 1 },
			{ x: 5, y: 2 },
			{ x: 5, y: 3 },
		];
		expect(fitLinearRegression(pairs)).toEqual({ ok: false, reason: 'zero-variance' });
	});

	it('produces NaN seResidual when n = 2 (no degrees of freedom)', () => {
		const result = fitLinearRegression([
			{ x: 0, y: 0 },
			{ x: 1, y: 1 },
		]);
		expect(result.ok).toBe(true);
		expect(result.seResidual).toBeNaN();
	});
});

describe('computeRegression', () => {
	const linearPontos = [
		{ x: 1, y: 3 },
		{ x: 2, y: 5 },
		{ x: 3, y: 7 },
		{ x: 4, y: 9 },
		{ x: 5, y: 11 },
	];

	const noisyLinearPontos = [
		{ x: 1, y: 3.1 },
		{ x: 2, y: 4.9 },
		{ x: 3, y: 7.2 },
		{ x: 4, y: 8.8 },
		{ x: 5, y: 11.1 },
	];

	it('returns one overall group when no groupBy is provided', () => {
		const results = computeRegression({
			pontos: linearPontos,
			xScale: 'linear',
			yScale: 'linear',
			xDomain: [1, 5],
		});
		expect(results).toHaveLength(1);
		expect(results[0].groupKey).toBe('__overall__');
		expect(results[0].fit.ok).toBe(true);
		expect(results[0].fit.slope).toBeCloseTo(2, 10);
		expect(results[0].fit.intercept).toBeCloseTo(1, 10);
		expect(results[0].sampleLine.length).toBeGreaterThan(2);
	});

	it('produces a confidence band when the fit has residual variance', () => {
		const results = computeRegression({
			pontos: noisyLinearPontos,
			xScale: 'linear',
			yScale: 'linear',
			xDomain: [1, 5],
		});
		expect(results[0].sampleBand).not.toBeNull();
		expect(results[0].sampleBand.length).toBe(results[0].sampleLine.length);
		const xMean = results[0].fit.xMean;
		const midSample = results[0].sampleBand.reduce((closest, point) =>
			Math.abs(point.x - xMean) < Math.abs(closest.x - xMean) ? point : closest
		);
		const edgeSample = results[0].sampleBand[0];
		const midHalfWidth = midSample.yHigh - midSample.yLow;
		const edgeHalfWidth = edgeSample.yHigh - edgeSample.yLow;
		expect(midHalfWidth).toBeLessThan(edgeHalfWidth);
	});

	it('returns sampleBand = null when the fit is exact (ssRes = 0)', () => {
		const results = computeRegression({
			pontos: linearPontos,
			xScale: 'linear',
			yScale: 'linear',
			xDomain: [1, 5],
		});
		expect(results[0].sampleBand).toBeNull();
	});

	it('sampleLine endpoints span the x domain', () => {
		const results = computeRegression({
			pontos: linearPontos,
			xScale: 'linear',
			yScale: 'linear',
			xDomain: [0, 10],
		});
		const line = results[0].sampleLine;
		expect(line[0].x).toBeCloseTo(0, 10);
		expect(line[line.length - 1].x).toBeCloseTo(10, 10);
		expect(line[0].y).toBeCloseTo(1, 10);
		expect(line[line.length - 1].y).toBeCloseTo(21, 10);
	});

	it('fits in log(x) space when xScale is log and recovers slope/intercept', () => {
		const pontos = [1, 10, 100, 1000].map(x => ({ x, y: 3 * Math.log(x) + 1 }));
		const results = computeRegression({
			pontos,
			xScale: 'log',
			yScale: 'linear',
			xDomain: [1, 1000],
		});
		expect(results[0].fit.ok).toBe(true);
		expect(results[0].fit.slope).toBeCloseTo(3, 6);
		expect(results[0].fit.intercept).toBeCloseTo(1, 6);
		const line = results[0].sampleLine;
		for (let i = 1; i < line.length; i++) {
			expect(line[i].x).toBeGreaterThan(line[i - 1].x);
		}
	});

	it('groups points by groupBy and fits each group independently', () => {
		const pontos = [
			{ x: 0, y: 0, cat: 'A' },
			{ x: 1, y: 1, cat: 'A' },
			{ x: 2, y: 2, cat: 'A' },
			{ x: 0, y: 0, cat: 'B' },
			{ x: 1, y: 5, cat: 'B' },
			{ x: 2, y: 10, cat: 'B' },
		];
		const results = computeRegression({
			pontos,
			xScale: 'linear',
			yScale: 'linear',
			xDomain: [0, 2],
			groupBy: p => p.cat,
		});
		expect(results).toHaveLength(2);
		const byKey = new Map(results.map(r => [r.groupKey, r]));
		expect(byKey.get('A').fit.slope).toBeCloseTo(1, 10);
		expect(byKey.get('B').fit.slope).toBeCloseTo(5, 10);
	});

	it('returns sampleBand = null when n < 3', () => {
		const results = computeRegression({
			pontos: [
				{ x: 0, y: 0 },
				{ x: 1, y: 1 },
			],
			xScale: 'linear',
			yScale: 'linear',
			xDomain: [0, 1],
		});
		expect(results[0].fit.ok).toBe(true);
		expect(results[0].sampleBand).toBeNull();
	});

	it('skips groups with too few points or zero variance', () => {
		const pontos = [
			{ x: 0, y: 0, cat: 'A' },
			{ x: 1, y: 1, cat: 'A' },
			{ x: 2, y: 2, cat: 'A' },
			{ x: 5, y: 5, cat: 'B' },
		];
		const results = computeRegression({
			pontos,
			xScale: 'linear',
			yScale: 'linear',
			xDomain: [0, 5],
			groupBy: p => p.cat,
		});
		const byKey = new Map(results.map(r => [r.groupKey, r]));
		expect(byKey.get('A').fit.ok).toBe(true);
		expect(byKey.get('B').fit.ok).toBe(false);
		expect(byKey.get('B').sampleLine).toBeNull();
	});
});

describe('formatRegressionEquation', () => {
	it('formats linear-linear as y = a·x + b', () => {
		const out = formatRegressionEquation({
			slope: 2,
			intercept: 1,
			xScale: 'linear',
			yScale: 'linear',
		});
		expect(out).toBe('y = 2·x + 1');
	});

	it('uses minus for negative intercept', () => {
		const out = formatRegressionEquation({
			slope: 2,
			intercept: -3,
			xScale: 'linear',
			yScale: 'linear',
		});
		expect(out).toBe('y = 2·x − 3');
	});

	it('uses log(x) when xScale is log', () => {
		const out = formatRegressionEquation({
			slope: 3,
			intercept: 1,
			xScale: 'log',
			yScale: 'linear',
		});
		expect(out).toBe('y = 3·log(x) + 1');
	});

	it('uses log(y) when yScale is log', () => {
		const out = formatRegressionEquation({
			slope: 0.5,
			intercept: 2,
			xScale: 'linear',
			yScale: 'log',
		});
		expect(out).toBe('log(y) = 0.5·x + 2');
	});

	it('handles log-log (power-law shape)', () => {
		const out = formatRegressionEquation({
			slope: 2,
			intercept: 1,
			xScale: 'log',
			yScale: 'log',
		});
		expect(out).toBe('log(y) = 2·log(x) + 1');
	});
});

describe('formatR2', () => {
	it('formats to 3 decimal places', () => {
		expect(formatR2(0.987654)).toBe('0.988');
		expect(formatR2(1)).toBe('1.000');
		expect(formatR2(0)).toBe('0.000');
	});

	it('returns NaN string for invalid input', () => {
		expect(formatR2(NaN)).toBe('NaN');
	});
});
