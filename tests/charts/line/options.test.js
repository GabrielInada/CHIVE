import { describe, expect, it } from 'vitest';
import { normalizeLineOptions } from '../../../src/charts/line/options.js';
import { CHART_COLORS, CHART_DIMENSIONS } from '../../../src/config/charts/definitions.js';
import { LINE_CHART } from '../../../src/config/charts/definitions/line.js';

describe('normalizeLineOptions', () => {
	it('applies defaults for an empty config', () => {
		const o = normalizeLineOptions({});
		expect(o.strokeWidth).toBe(LINE_CHART.defaultStrokeWidth);
		expect(o.color).toBe(CHART_COLORS.line);
		expect(o.ghostColor).toBe(LINE_CHART.defaultGhostStrokeColor);
		expect(o.showPoints).toBe(false);
		expect(o.sortX).toBe(true);
		expect(o.showXAxisLabel).toBe(true);
		expect(o.showYAxisLabel).toBe(true);
		expect(o.customTitle).toBe('');
		expect(o.chartHeight).toBe(CHART_DIMENSIONS.line.height);
	});

	// Chart config canonicalization checks the enumerated settings against the
	// chart's definition, so the normalizer reads them as given.
	it.each([
		['missingMode', 'interpolate'],
		['aggregateMode', 'mean'],
	])('reads %s as given', (key, value) => {
		expect(normalizeLineOptions({ [key]: value })[key]).toBe(value);
		expect(normalizeLineOptions({})[key]).toBeUndefined();
	});

	it('clamps strokeWidth to 0.5..8 and chartHeight to 220..720', () => {
		expect(normalizeLineOptions({ strokeWidth: 0 }).strokeWidth).toBe(0.5);
		expect(normalizeLineOptions({ strokeWidth: 99 }).strokeWidth).toBe(8);
		expect(normalizeLineOptions({ chartHeight: 10 }).chartHeight).toBe(220);
		expect(normalizeLineOptions({ chartHeight: 9000 }).chartHeight).toBe(720);
	});

	it('falls back to defaults for invalid colors', () => {
		expect(normalizeLineOptions({ color: 'nope' }).color).toBe(CHART_COLORS.line);
		expect(normalizeLineOptions({ ghostStrokeColor: 'nope' }).ghostColor).toBe(LINE_CHART.defaultGhostStrokeColor);
		expect(normalizeLineOptions({ color: '#abc123' }).color).toBe('#abc123');
	});

	it('toggles booleans only on the expected sentinel values', () => {
		expect(normalizeLineOptions({ showPoints: true }).showPoints).toBe(true);
		expect(normalizeLineOptions({ showPoints: 'yes' }).showPoints).toBe(false);
		expect(normalizeLineOptions({ sortX: false }).sortX).toBe(false);
		expect(normalizeLineOptions({ showXAxisLabel: false }).showXAxisLabel).toBe(false);
	});
});
