import { describe, expect, it } from 'vitest';
import { normalizeTreemapOptions } from '../../../src/charts/treemap/options.js';
import { CHART_COLORS } from '../../../src/config/charts/definitions.js';
import { TREEMAP_CHART } from '../../../src/config/charts/definitions/treemap.js';

describe('normalizeTreemapOptions', () => {
	it('applies defaults for an empty options bag', () => {
		const o = normalizeTreemapOptions({});
		expect(o.measureMode).toBe(TREEMAP_CHART.defaultMeasureMode);
		expect(o.valueColumn).toBeNull();
		expect(o.topN).toBe(TREEMAP_CHART.defaultTopN);
		expect(o.padding).toBe(TREEMAP_CHART.defaultPadding);
		expect(o.showLabels).toBe(true);
		expect(o.showValues).toBe(true);
		expect(o.customTitle).toBe('');
		expect(o.chartHeight).toBe(380);
		expect(o.colorMode).toBe('scheme');
		expect(o.colorScheme).toBe('Bold');
		expect(o.uniformColor).toBe(CHART_COLORS.treemap);
		expect(o.locale).toBeUndefined();
	});

	it('coerces an unknown measureMode to the default', () => {
		expect(normalizeTreemapOptions({ measureMode: 'median' }).measureMode).toBe(TREEMAP_CHART.defaultMeasureMode);
		expect(normalizeTreemapOptions({ measureMode: 'sum' }).measureMode).toBe('sum');
	});

	it('coerces topN from string and keeps a negative value (no-trim sentinel) as-is', () => {
		expect(normalizeTreemapOptions({ topN: '20' }).topN).toBe(20);
		expect(normalizeTreemapOptions({ topN: -1 }).topN).toBe(-1);
		expect(normalizeTreemapOptions({ topN: 'nope' }).topN).toBe(TREEMAP_CHART.defaultTopN);
	});

	it('clamps padding to 1..6 and chartHeight to 220..720', () => {
		expect(normalizeTreemapOptions({ padding: 0 }).padding).toBe(1);
		expect(normalizeTreemapOptions({ padding: 99 }).padding).toBe(6);
		expect(normalizeTreemapOptions({ chartHeight: 100 }).chartHeight).toBe(220);
		expect(normalizeTreemapOptions({ chartHeight: 9000 }).chartHeight).toBe(720);
	});

	it('falls back to the default treemap color when the uniform color is invalid', () => {
		expect(normalizeTreemapOptions({ color: 'not-a-hex' }).uniformColor).toBe(CHART_COLORS.treemap);
		expect(normalizeTreemapOptions({ color: '#123abc' }).uniformColor).toBe('#123abc');
	});

	it('truncates a long custom title to 80 chars and toggles labels/values off only on false', () => {
		expect(normalizeTreemapOptions({ customTitle: 'x'.repeat(120) }).customTitle).toHaveLength(80);
		expect(normalizeTreemapOptions({ showLabels: false, showValues: false }))
			.toMatchObject({ showLabels: false, showValues: false });
		expect(normalizeTreemapOptions({ showLabels: 0 }).showLabels).toBe(true);
	});

	it('passes through caller-supplied labels and falls back per-key', () => {
		const o = normalizeTreemapOptions({ labels: { category: 'Região', sum: 'Soma' } });
		expect(o.labels.category).toBe('Região');
		expect(o.labels.sum).toBe('Soma');
		expect(o.labels.count).toBe('Count');
	});
});
