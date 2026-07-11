// @vitest-environment jsdom

/**
 * SVG-equivalence guard for the pieChart data-model extraction.
 *
 * Captured against the pre-extraction renderer, this pins the SVG markup plus
 * the returned result object for a representative option matrix. The extraction
 * is a pure code move, so every snapshot below must stay byte-identical
 * afterwards. Conditions are stabilized for determinism: explicit locale, a
 * pinned `clientWidth`, a fixed `chartHeight`, and fixed rows.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderPieChart } from '../../../../src/modules/visualizations/pieChart.js';
import { hideChartTooltip } from '../../../../src/charts/shared/tooltip/tooltip.js';

const ROWS = [
	{ region: 'A', sales: 30 },
	{ region: 'A', sales: 10 },
	{ region: 'B', sales: 25 },
	{ region: 'C', sales: 15 },
	{ region: 'D', sales: 8 },
	{ region: 'E', sales: 5 },
	{ region: '', sales: 2 },
];

const BASE = { locale: 'en-US', chartHeight: 400 };

function makeContainer() {
	document.body.innerHTML = '<div id="pie"></div>';
	const container = document.getElementById('pie');
	Object.defineProperty(container, 'clientWidth', { value: 640, configurable: true });
	return container;
}

function render(options, rows = ROWS) {
	const container = makeContainer();
	const result = renderPieChart(container, rows, 'region', { ...BASE, ...options });
	const svg = container.querySelector('svg');
	return { html: svg?.outerHTML ?? container.innerHTML, result };
}

const CASES = {
	'count (default)': {},
	'sum measure': { measureMode: 'sum', valueColumn: 'sales' },
	'top-3 with other bucket': { topN: 3, topNMode: 'other' },
	'top-3 truncate': { topN: 3, topNMode: 'truncate' },
	'donut (inner radius)': { innerRadius: 40 },
	'outside labels': { labelPosition: 'outside' },
	'no legend': { showLegend: false },
	'custom slice colors': { customSliceColors: { A: '#ff0000', B: '#00ff00' } },
	'sum with missing valueColumn (fail)': { measureMode: 'sum' },
};

describe('pieChart render equivalence (pure-move guard)', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="pie"></div>';
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

	it('is byte-stable: empty rows (fail)', () => {
		const { html, result } = render({}, []);
		expect(result).toMatchSnapshot();
		expect(html).toMatchSnapshot();
	});
});
