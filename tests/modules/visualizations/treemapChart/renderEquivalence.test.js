// @vitest-environment jsdom

/**
 * SVG-equivalence guard for the treemapChart data-model extraction.
 *
 * Captured against the pre-extraction renderer, this pins the SVG markup plus
 * the returned result object for a representative option matrix. The extraction
 * is a pure code move, so every snapshot below must stay byte-identical
 * afterwards. Conditions are stabilized for determinism: explicit locale, a
 * pinned `clientWidth` (jsdom does no layout, so `container.clientWidth` is 0
 * and a CSS width is ignored), a fixed `chartHeight`, and fixed rows.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderTreeMap } from '../../../../src/modules/visualizations/treemapChart.js';
import { hideChartTooltip } from '../../../../src/charts/shared/tooltip/tooltip.js';

const ROWS = [
	{ region: 'A', sales: 10 },
	{ region: 'A', sales: 5 },
	{ region: 'B', sales: 20 },
	{ region: 'C', sales: 8 },
	{ region: 'C', sales: 2 },
	{ region: '', sales: 3 },
	{ region: 'D', sales: 1 },
];

const BASE = { locale: 'en-US', chartHeight: 400 };

function makeContainer() {
	document.body.innerHTML = '<div id="treemap"></div>';
	const container = document.getElementById('treemap');
	// jsdom does no layout: pin clientWidth so the renderer uses a real width.
	Object.defineProperty(container, 'clientWidth', { value: 640, configurable: true });
	return container;
}

function render(options, rows = ROWS) {
	const container = makeContainer();
	const result = renderTreeMap(container, rows, 'region', { ...BASE, ...options });
	const svg = container.querySelector('svg');
	return { html: svg?.outerHTML ?? container.innerHTML, result };
}

const CASES = {
	'count, scheme color (default)': {},
	'sum measure, scheme color': { measureMode: 'sum', valueColumn: 'sales' },
	'count, uniform color': { colorMode: 'uniform', color: '#336699' },
	'count, top-2 trim': { topN: 2 },
	'count, labels only': { showValues: false },
	'count, values only': { showLabels: false },
	'count, no labels or values': { showLabels: false, showValues: false },
	'sum with missing valueColumn (fail)': { measureMode: 'sum' },
};

describe('treemapChart render equivalence (pure-move guard)', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="treemap"></div>';
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
