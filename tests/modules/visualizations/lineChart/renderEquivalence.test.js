// @vitest-environment jsdom

/**
 * SVG-equivalence guard for the lineChart data-model extraction.
 *
 * Captured against the pre-extraction renderer, this pins the SVG markup plus
 * the returned result object for a representative option matrix spanning the
 * three x-kinds (numeric / categorical / date), the missing-value modes, and
 * the aggregate modes. The extraction is a pure code move, so every snapshot
 * below must stay byte-identical afterwards. Conditions are stabilized for
 * determinism: explicit locale, a pinned `clientWidth`, fixed `chartHeight`,
 * fixed rows, and fixed ISO date strings for the date x-kind.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderLineChart } from '../../../../src/modules/visualizations/lineChart.js';
import { hideChartTooltip } from '../../../../src/charts/shared/tooltip/tooltip.js';

const ROWS_NUM = [
	{ x: 1, y: 10 },
	{ x: 2, y: 5 },
	{ x: 3, y: 8 },
	{ x: 2, y: 3 },
	{ x: 4, y: null },
];
const ROWS_CAT = [{ x: 'Jan', y: 10 }, { x: 'Feb', y: 5 }, { x: 'Mar', y: 8 }];
const ROWS_DATE = [{ x: '2024-01-01', y: 10 }, { x: '2024-02-01', y: 5 }, { x: '2024-03-01', y: 8 }];

const BASE = { locale: 'en-US', chartHeight: 320 };

function makeContainer() {
	document.body.innerHTML = '<div id="line"></div>';
	const container = document.getElementById('line');
	Object.defineProperty(container, 'clientWidth', { value: 700, configurable: true });
	return container;
}

function render(options, rows = ROWS_NUM) {
	const container = makeContainer();
	const result = renderLineChart(container, rows, 'x', 'y', { ...BASE, ...options });
	const svg = container.querySelector('svg');
	return { html: svg?.outerHTML ?? container.innerHTML, result };
}

const CASES = {
	'numeric x, default (connect)': { options: {} },
	'numeric x, missing gap': { options: { missingMode: 'gap' } },
	'numeric x, missing interpolate (ghost)': { options: { missingMode: 'interpolate' } },
	'numeric x, no sort': { options: { sortX: false } },
	'numeric x, show points': { options: { showPoints: true } },
	'numeric x, monotone curve': { options: { curve: 'monotone' } },
	'numeric x, aggregate sum': { options: { aggregateMode: 'sum' } },
	'numeric x, aggregate mean': { options: { aggregateMode: 'mean' } },
	'numeric x, aggregate count': { options: { aggregateMode: 'count' } },
	'categorical x': { options: { axisTypes: { x: 'text' } }, rows: ROWS_CAT },
	'date x': { options: { axisTypes: { x: 'date' } }, rows: ROWS_DATE },
	'all y missing (fail)': { options: {}, rows: [{ x: 1, y: null }, { x: 2, y: '' }] },
	'no x values (fail)': { options: {}, rows: [{ x: null, y: 1 }, { x: '', y: 2 }] },
};

describe('lineChart render equivalence (pure-move guard)', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="line"></div>';
	});

	afterEach(() => {
		hideChartTooltip();
		document.body.innerHTML = '';
	});

	for (const [name, { options, rows }] of Object.entries(CASES)) {
		it(`is byte-stable: ${name}`, () => {
			const { html, result } = render(options, rows);
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
