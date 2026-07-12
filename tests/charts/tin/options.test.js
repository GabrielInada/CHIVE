import { describe, expect, it } from 'vitest';
import { normalizeTinOptions } from '../../../src/charts/tin/options.js';

describe('normalizeTinOptions defaults', () => {
	it('returns the full validated config for an empty options bag', () => {
		// Locks the complete contract: forgetting to surface any local is the
		// likeliest regression after the split, so assert the whole object.
		expect(normalizeTinOptions({}, 'X', 'Y', 'Z')).toStrictEqual({
			fillMode: 'smooth',
			colorRenderingMode: 'optimized',
			gradientMin: '#5d8aa8',
			gradientMax: '#ffffff',
			gradientDistribution: 'value',
			colorRamp: 'custom',
			showEdges: true,
			edgeColor: '#5f5a53',
			showPoints: true,
			pointRadius: 3,
			showZLabels: false,
			showHull: false,
			hullColor: '#3f3a33',
			showIsolines: false,
			isolineMode: 'count',
			isolineCount: 5,
			isolineStep: 1,
			isolineColor: '#1f2937',
			isolineWidth: 0.8,
			showIsolineLabels: false,
			isolineLabelSize: 10,
			isolineLabelColor: '#1f2937',
			colorIsolinesByZ: false,
			isolineMinColor: '#1e40af',
			isolineMaxColor: '#dc2626',
			showThreshold: false,
			thresholdValue: 0,
			thresholdColor: '#dc2626',
			thresholdWidth: 2,
			showXAxisLabel: true,
			showYAxisLabel: true,
			customTitle: '',
			chartHeight: 460,
			locale: undefined,
			axisLabels: { x: 'X', y: 'Y', z: 'Z' },
			requestedSubdivisionDepth: undefined,
		});
	});

	it('uses provided axis labels over the column names, and passes locale through', () => {
		const cfg = normalizeTinOptions(
			{ axisLabels: { x: 'East', z: 'Elev' }, locale: 'pt-BR' },
			'X',
			'Y',
			'Z',
		);
		expect(cfg.axisLabels).toEqual({ x: 'East', y: 'Y', z: 'Elev' });
		expect(cfg.locale).toBe('pt-BR');
	});
});

describe('normalizeTinOptions enum collapse', () => {
	it.each([
		['fillMode', 'flat', 'flat'],
		['fillMode', 'weird', 'smooth'],
		['colorRenderingMode', 'full-ramp', 'full-ramp'],
		['colorRenderingMode', 'weird', 'optimized'],
		['isolineMode', 'step', 'step'],
		['isolineMode', 'weird', 'count'],
		['gradientDistribution', 'rank', 'rank'],
		['gradientDistribution', 'weird', 'value'],
		['colorRamp', 'viridis', 'viridis'],
		['colorRamp', 'nonsense', 'custom'],
	])('%s=%s -> %s', (key, input, expected) => {
		expect(normalizeTinOptions({ [key]: input }, 'X', 'Y', 'Z')[key]).toBe(expected);
	});
});

describe('normalizeTinOptions bounds', () => {
	it.each([
		['chartHeight', 99999, 900],
		['chartHeight', 10, 220],
		['isolineCount', 999, 20],
		['isolineCount', 1, 2],
		['isolineWidth', 5, 2],
		['isolineWidth', 0.1, 0.5],
		['isolineLabelSize', 99, 14],
		['isolineLabelSize', 1, 8],
		['thresholdWidth', 99, 4],
		['thresholdWidth', 0.1, 0.5],
		['pointRadius', 0, 1],
	])('clamps %s=%s -> %s', (key, input, expected) => {
		expect(normalizeTinOptions({ [key]: input }, 'X', 'Y', 'Z')[key]).toBe(expected);
	});

	it('falls back to a valid color when an input is not a hex color', () => {
		expect(normalizeTinOptions({ edgeColor: 'not-a-color' }, 'X', 'Y', 'Z').edgeColor).toBe('#5f5a53');
		expect(normalizeTinOptions({ edgeColor: '#abcdef' }, 'X', 'Y', 'Z').edgeColor).toBe('#abcdef');
	});

	it('trims and caps the custom title at 80 characters', () => {
		const cfg = normalizeTinOptions({ customTitle: `  ${'a'.repeat(100)}  ` }, 'X', 'Y', 'Z');
		expect(cfg.customTitle).toHaveLength(80);
	});

	it('passes the raw subdivision depth request through verbatim', () => {
		expect(normalizeTinOptions({ subdivisionDepth: 2 }, 'X', 'Y', 'Z').requestedSubdivisionDepth).toBe(2);
		expect(normalizeTinOptions({ subdivisionDepth: 99 }, 'X', 'Y', 'Z').requestedSubdivisionDepth).toBe(99);
	});
});
