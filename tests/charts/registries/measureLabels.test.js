// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../src/i18n/en.json';
import ptBR from '../../../src/i18n/pt-BR.json';
import { CHART_DEFINITIONS } from '../../../src/config/charts/definitions.js';
import { getPanelChartRenderer } from '../../../src/charts/registries/panel.js';
import { hideChartTooltip } from '../../../src/charts/shared/tooltip/tooltip.js';

const locale = vi.hoisted(() => ({ value: 'en' }));
const messages = { en, 'pt-BR': ptBR };

vi.mock('../../../src/services/i18nService.js', () => ({
	t: key => messages[locale.value][key] || key,
	getLocale: () => locale.value,
}));

const MEASURE_LABELS = {
	en: { count: 'Count', sum: 'Sum', mean: 'Mean' },
	'pt-BR': { count: 'Contagem', sum: 'Soma', mean: 'Média' },
};

const rows = [
	{ team: 'A', sales: 10 },
	{ team: 'A', sales: 20 },
	{ team: 'B', sales: 5 },
];
const columns = [
	{ name: 'team', type: 'text' },
	{ name: 'sales', type: 'number' },
];
const MARKS = { bar: 'rect', pie: 'path', treemap: 'rect', bubble: '.bubble-node' };
const cases = Object.keys(MARKS).flatMap(type =>
	CHART_DEFINITIONS[type].allowedValues.measureMode.map(measure => [type, measure]));

describe.each(['en', 'pt-BR'])('Measure labels in %s', language => {
	let container;

	beforeEach(() => {
		locale.value = language;
		document.body.innerHTML = '<div id="chart"></div>';
		container = document.getElementById('chart');
	});

	afterEach(() => {
		hideChartTooltip();
	});

	it.each(cases)('names the measure of a %s chart measured by %s', (type, measure) => {
		const result = getPanelChartRenderer(type)(container, {
			type,
			config: {
				...CHART_DEFINITIONS[type].createDefaultConfig(),
				category: 'team',
				measureMode: measure,
				valueColumn: measure === 'count' ? null : 'sales',
			},
			dataSnapshot: rows,
			columnsSnapshot: columns,
		});
		expect(result.ok).toBe(true);

		const expected = MEASURE_LABELS[language][measure];
		const others = Object.values(MEASURE_LABELS[language]).filter(label => label !== expected);

		container.querySelector(MARKS[type])
			.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100, clientY: 100 }));
		const lineLabels = [...document.querySelectorAll('.chart-tooltip strong')].map(node => node.textContent);
		expect(lineLabels).toContain(`${expected}:`);
		for (const other of others) expect(lineLabels).not.toContain(`${other}:`);

		if (type === 'bar') {
			expect(container.querySelector('text[transform="rotate(-90)"]').textContent).toBe(expected);
		}
		if (type === 'bubble') {
			expect(container.querySelector('.bubble-node title').textContent).toContain(`\n${expected}: `);
		}
	});
});
