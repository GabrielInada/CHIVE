import { describe, expect, it } from 'vitest';
import { normalizeScatter3dOptions } from '../../../src/charts/scatter3d/options.js';
import { CHART_HEIGHT_LIMITS, SCATTER3D_CHART } from '../../../src/config/charts.js';

describe('normalizeScatter3dOptions', () => {
	it('returns the defaults for an empty call', () => {
		const options = normalizeScatter3dOptions();

		expect(options).toEqual({
			chartHeight: 460,
			pointSize: SCATTER3D_CHART.defaultPointSize,
			opacity: SCATTER3D_CHART.defaultOpacity,
			color: '#2f6b4f',
			customTitle: '',
		});
	});

	it('clamps chartHeight, pointSize, and opacity to their limits', () => {
		const options = normalizeScatter3dOptions({
			chartHeight: 10000,
			pointSize: 99,
			opacity: -5,
		});

		expect(options.chartHeight).toBe(CHART_HEIGHT_LIMITS.scatter3d.max);
		expect(options.pointSize).toBe(SCATTER3D_CHART.maxPointSize);
		expect(options.opacity).toBe(SCATTER3D_CHART.minOpacity);
	});

	it('accepts numeric strings and falls back on non-numeric input', () => {
		const options = normalizeScatter3dOptions({
			chartHeight: '500',
			pointSize: 'huge',
			opacity: '0.5',
		});

		expect(options.chartHeight).toBe(500);
		expect(options.pointSize).toBe(SCATTER3D_CHART.defaultPointSize);
		expect(options.opacity).toBe(0.5);
	});

	it('keeps a provided color and trims the custom title', () => {
		const options = normalizeScatter3dOptions({ color: '#123456', customTitle: '  Depth view  ' });

		expect(options.color).toBe('#123456');
		expect(options.customTitle).toBe('Depth view');
	});

	it('falls back to the default color for blank or non-string colors', () => {
		expect(normalizeScatter3dOptions({ color: '   ' }).color).toBe('#2f6b4f');
		expect(normalizeScatter3dOptions({ color: 42 }).color).toBe('#2f6b4f');
	});
});
