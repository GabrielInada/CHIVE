import { describe, expect, it } from 'vitest';
import { normalizeLineOptions } from '../../../src/charts/line/options.js';
import { CHART_COLORS, CHART_DIMENSIONS } from '../../../src/config/charts/definitions.js';
import { LINE_CHART } from '../../../src/config/charts/definitions/line.js';

describe('normalizeLineOptions', () => {
	it('applies defaults for an empty options bag', () => {
		const o = normalizeLineOptions({}, 'month', 'visits');
		expect(o.missingMode).toBe(LINE_CHART.defaultMissingMode);
		expect(o.strokeWidth).toBe(LINE_CHART.defaultStrokeWidth);
		expect(o.color).toBe(CHART_COLORS.line);
		expect(o.ghostColor).toBe(LINE_CHART.defaultGhostStrokeColor);
		expect(o.showPoints).toBe(false);
		expect(o.sortX).toBe(true);
		expect(o.aggregateMode).toBe('none');
		expect(o.showXAxisLabel).toBe(true);
		expect(o.showYAxisLabel).toBe(true);
		expect(o.customTitle).toBe('');
		expect(o.chartHeight).toBe(CHART_DIMENSIONS.line.height);
		expect(o.axisLabels).toEqual({ x: 'month', y: 'visits' });
	});

	it('collapses missingMode and aggregateMode to their enums', () => {
		expect(normalizeLineOptions({ missingMode: 'interpolate' }, 'x', 'y').missingMode).toBe('interpolate');
		expect(normalizeLineOptions({ missingMode: 'bogus' }, 'x', 'y').missingMode).toBe(LINE_CHART.defaultMissingMode);
		expect(normalizeLineOptions({ aggregateMode: 'mean' }, 'x', 'y').aggregateMode).toBe('mean');
		expect(normalizeLineOptions({ aggregateMode: 'bogus' }, 'x', 'y').aggregateMode).toBe('none');
	});

	it('clamps strokeWidth to 0.5..8 and chartHeight to 220..720', () => {
		expect(normalizeLineOptions({ strokeWidth: 0 }, 'x', 'y').strokeWidth).toBe(0.5);
		expect(normalizeLineOptions({ strokeWidth: 99 }, 'x', 'y').strokeWidth).toBe(8);
		expect(normalizeLineOptions({ chartHeight: 10 }, 'x', 'y').chartHeight).toBe(220);
		expect(normalizeLineOptions({ chartHeight: 9000 }, 'x', 'y').chartHeight).toBe(720);
	});

	it('falls back to defaults for invalid colors and honors explicit axis labels', () => {
		expect(normalizeLineOptions({ color: 'nope' }, 'x', 'y').color).toBe(CHART_COLORS.line);
		expect(normalizeLineOptions({ ghostStrokeColor: 'nope' }, 'x', 'y').ghostColor).toBe(LINE_CHART.defaultGhostStrokeColor);
		expect(normalizeLineOptions({ color: '#abc123' }, 'x', 'y').color).toBe('#abc123');
		expect(normalizeLineOptions({ axisLabels: { x: 'Mês', y: 'Visitas' } }, 'x', 'y').axisLabels)
			.toEqual({ x: 'Mês', y: 'Visitas' });
	});

	it('toggles booleans only on the expected sentinel values', () => {
		expect(normalizeLineOptions({ showPoints: true }, 'x', 'y').showPoints).toBe(true);
		expect(normalizeLineOptions({ showPoints: 'yes' }, 'x', 'y').showPoints).toBe(false);
		expect(normalizeLineOptions({ sortX: false }, 'x', 'y').sortX).toBe(false);
		expect(normalizeLineOptions({ showXAxisLabel: false }, 'x', 'y').showXAxisLabel).toBe(false);
	});
});
