// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../src/i18n/en.json';
import { CHART_DEFINITIONS } from '../../../src/config/charts/definitions.js';
import { getPanelChartRenderer } from '../../../src/charts/registries/panel.js';
import { hideChartTooltip } from '../../../src/charts/shared/tooltip/tooltip.js';

vi.mock('../../../src/services/i18nService.js', () => ({
	t: key => en[key] || key,
	getLocale: () => 'en',
}));

// Per category: count C 3, B, D and G 2, A, E and F 1.
// Sum: B 30, C 24, F 20, A 18, G 2, D 0, E -6.
// Mean: F 20, A 18, B 15, C 8, G 1, D 0, E -6.
const rows = [
	{ team: 'A', sales: 18 },
	{ team: 'B', sales: 40 },
	{ team: 'B', sales: -10 },
	{ team: 'C', sales: 8 },
	{ team: 'C', sales: 8 },
	{ team: 'C', sales: 8 },
	{ team: 'D', sales: 12 },
	{ team: 'D', sales: -12 },
	{ team: 'E', sales: -6 },
	{ team: 'F', sales: 20 },
	{ team: 'G', sales: 1 },
	{ team: 'G', sales: 1 },
];
const columns = [
	{ name: 'team', type: 'text' },
	{ name: 'sales', type: 'number' },
];
const MARKS = { bar: 'rect', pie: 'path', treemap: 'rect', bubble: '.bubble-node' };
// Bar and pie draw their categories in a sequence; treemap and bubble lay
// them out, so only which categories they draw is compared.
const SEQUENCED = new Set(['bar', 'pie']);

const cases = [
	// Top 3 in value order, ties by category, after pie, treemap and bubble
	// leave out values at or below 0.
	['bar', { measureMode: 'count', topN: 3 }, ['C', 'B', 'D']],
	['bar', { measureMode: 'sum', topN: 3 }, ['B', 'C', 'F']],
	['bar', { measureMode: 'mean', topN: 3 }, ['F', 'A', 'B']],
	['pie', { measureMode: 'count', topN: 3, topNMode: 'other' }, ['C', 'B', 'D', 'Other']],
	['pie', { measureMode: 'count', topN: 3, topNMode: 'truncate' }, ['C', 'B', 'D']],
	['pie', { measureMode: 'sum', topN: 3, topNMode: 'other' }, ['B', 'C', 'F', 'Other']],
	['pie', { measureMode: 'sum', topN: 3, topNMode: 'truncate' }, ['B', 'C', 'F']],
	['treemap', { measureMode: 'count', topN: 3 }, ['B', 'C', 'D']],
	['treemap', { measureMode: 'sum', topN: 3 }, ['B', 'C', 'F']],
	['bubble', { measureMode: 'count', topN: 3 }, ['B', 'C', 'D']],
	['bubble', { measureMode: 'sum', topN: 3 }, ['B', 'C', 'F']],
	['bubble', { measureMode: 'mean', topN: 3 }, ['A', 'B', 'F']],
	// With no Top-N, bar draws every category, 0 and below included.
	['bar', { measureMode: 'sum', topN: 0 }, ['B', 'C', 'F', 'A', 'G', 'D', 'E']],
	['bar', { measureMode: 'mean', topN: 0 }, ['F', 'A', 'B', 'C', 'G', 'D', 'E']],
	['pie', { measureMode: 'sum', topN: 0 }, ['B', 'C', 'F', 'A', 'G']],
	['treemap', { measureMode: 'sum', topN: 0 }, ['A', 'B', 'C', 'F', 'G']],
	['bubble', { measureMode: 'sum', topN: 0 }, ['A', 'B', 'C', 'F', 'G']],
	['bubble', { measureMode: 'mean', topN: 0 }, ['A', 'B', 'C', 'F', 'G']],
	// Bar's Top-N keeps the first bars in its own sort order.
	['bar', { measureMode: 'sum', topN: 3, sort: 'value-asc' }, ['E', 'D', 'G']],
	['bar', { measureMode: 'sum', topN: 3, sort: 'label-asc' }, ['A', 'B', 'C']],
	['bar', { measureMode: 'sum', topN: 3, sort: 'label-desc' }, ['G', 'F', 'E']],
];

function render(type, overrides) {
	document.body.innerHTML = '<div id="chart"></div>';
	const container = document.getElementById('chart');
	const result = getPanelChartRenderer(type)(container, {
		type,
		config: { ...CHART_DEFINITIONS[type].createDefaultConfig(), category: 'team', valueColumn: 'sales', ...overrides },
		dataSnapshot: rows,
		columnsSnapshot: columns,
	});
	expect(result.ok).toBe(true);
	return container;
}

// The [label, value] lines of the tooltip a mark pins.
function tooltipLines(mark) {
	mark.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100, clientY: 100 }));
	const lines = [...document.querySelectorAll('.chart-tooltip strong')]
		.map(name => [name.textContent, name.parentElement.textContent.slice(name.textContent.length).trim()]);
	hideChartTooltip();
	return lines;
}

describe('drawn categories of the bar, pie, treemap and bubble charts', () => {
	afterEach(() => {
		hideChartTooltip();
	});

	it('covers every measure each chart allows', () => {
		for (const type of Object.keys(MARKS)) {
			const measures = new Set(cases.filter(([caseType]) => caseType === type).map(([, { measureMode }]) => measureMode));
			expect([...measures].sort()).toEqual([...CHART_DEFINITIONS[type].allowedValues.measureMode].sort());
		}
	});

	it.each(cases)('%s with %j draws %j', (type, overrides, expected) => {
		const container = render(type, overrides);
		const drawn = [...container.querySelectorAll(MARKS[type])].map(mark => tooltipLines(mark)[0][1]);
		expect(SEQUENCED.has(type) ? drawn : drawn.sort()).toEqual(expected);
	});

	it.each([
		['count', [['Category (pie/donut):', 'Other'], ['Count:', '5'], ['Percentage:', '41.7%']]],
		['sum', [['Category (pie/donut):', 'Other'], ['Sum:', '20'], ['Percentage:', '21.3%']]],
	])('pie folds what Top-N leaves out of a %s into the Other sector, a share of the whole circle', (measureMode, expected) => {
		const container = render('pie', { measureMode, topN: 3, topNMode: 'other' });
		expect(tooltipLines([...container.querySelectorAll('path')].at(-1))).toEqual(expected);
	});
});
