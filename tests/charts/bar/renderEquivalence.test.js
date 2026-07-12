// @vitest-environment jsdom

/**
 * SVG-equivalence guard for the barChart data-model extraction.
 *
 * Captured against the pre-extraction renderer, this pins the SVG markup plus
 * the returned result object for a representative option matrix. The extraction
 * is a pure code move, so every snapshot below must stay byte-identical
 * afterwards. Conditions are stabilized for determinism: explicit locale, a
 * pinned `clientWidth`, a fixed `chartHeight`, and fixed rows.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderBarChart } from '../../../src/charts/bar/renderers/svg.js';
import { hideChartTooltip } from '../../../src/charts/shared/tooltip/tooltip.js';

const ROWS = [
	{ region: 'A', sales: 30 },
	{ region: 'A', sales: 10 },
	{ region: 'B', sales: 25 },
	{ region: 'B', sales: 5 },
	{ region: 'C', sales: 12 },
	{ region: 'D', sales: 8 },
	{ region: '', sales: 3 },
];

const BASE = { locale: 'en-US', chartHeight: 320 };

function makeContainer() {
	document.body.innerHTML = '<div id="bar"></div>';
	const container = document.getElementById('bar');
	Object.defineProperty(container, 'clientWidth', { value: 700, configurable: true });
	return container;
}

function render(options, rows = ROWS) {
	const container = makeContainer();
	const result = renderBarChart(container, rows, 'region', { ...BASE, ...options });
	const svg = container.querySelector('svg');
	return { html: svg?.outerHTML ?? container.innerHTML, result };
}

const CASES = {
	'count (default sort)': {},
	'count, sort count-asc': { sort: 'count-asc' },
	'count, sort label-asc': { sort: 'label-asc' },
	'count, sort label-desc': { sort: 'label-desc' },
	'sum measure': { measureMode: 'sum', valueColumn: 'sales' },
	'mean measure': { measureMode: 'mean', valueColumn: 'sales' },
	'count, top-2': { topN: 2 },
	'gradient (value)': { colorMode: 'gradient', gradientMinColor: '#0000ff', gradientMaxColor: '#ff0000' },
	'gradient (rank)': { colorMode: 'gradient', gradientDistribution: 'rank', gradientMinColor: '#0000ff', gradientMaxColor: '#ff0000' },
	'gradient-manual threshold': { colorMode: 'gradient-manual', manualThresholdPct: 60, gradientMinColor: '#0000ff', gradientMaxColor: '#ff0000' },
	'no axis labels': { showXAxisLabel: false, showYAxisLabel: false },
	'sum with missing valueColumn (fail)': { measureMode: 'sum' },
};

describe('barChart render equivalence (pure-move guard)', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="bar"></div>';
	});

	afterEach(() => {
		hideChartTooltip();
		document.body.innerHTML = '';
	});

	for (const [name, options] of Object.entries(CASES)) {
		it(`is byte-stable: ${name}`, () => {
			const { html, result } = render(options);
			expect(result).toMatchSnapshot();
			expect(html).toMatchSnapshot();
		});
	}

	it('is byte-stable: sum over non-numeric values (fail)', () => {
		const { html, result } = render(
			{ measureMode: 'sum', valueColumn: 'sales' },
			[{ region: 'A', sales: 'x' }, { region: 'B', sales: 'y' }],
		);
		expect(result).toMatchSnapshot();
		expect(html).toMatchSnapshot();
	});

	it('is byte-stable: empty rows (fail)', () => {
		const { html, result } = render({}, []);
		expect(result).toMatchSnapshot();
		expect(html).toMatchSnapshot();
	});
});
