// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../src/i18n/en.json';
import ptBR from '../../../src/i18n/pt-BR.json';
import { getChartControlAdapter } from '../../../src/charts/registries/controls.js';
import { buildDescribedControls } from '../../../src/charts/shared/controls/describedControls.js';
import { createDefaultChartConfig } from '../../../src/config/charts/defaults.js';
import { t } from '../../../src/services/i18nService.js';

const locale = vi.hoisted(() => ({ value: 'en' }));
const messages = { en, 'pt-BR': ptBR };

vi.mock('../../../src/services/i18nService.js', () => ({
	t: (key, ...params) => params.reduce(
		(text, param, index) => text.replaceAll(`$${index + 1}`, param),
		messages[locale.value][key] ?? key,
	),
	getLocale: () => locale.value,
}));

const TYPES = ['bar', 'pie', 'treemap', 'bubble'];
const MEASURES = {
	bar: ['count', 'sum', 'mean'],
	pie: ['count', 'sum'],
	treemap: ['count', 'sum'],
	bubble: ['count', 'sum', 'mean'],
};
const LABELS = {
	en: {
		measures: { count: 'Count rows', sum: 'Sum numeric column', mean: 'Average numeric column' },
		all: 'All',
		sorts: {
			count: ['Count (high → low)', 'Count (low → high)'],
			sum: ['Sum (high → low)', 'Sum (low → high)'],
			mean: ['Mean (high → low)', 'Mean (low → high)'],
		},
		names: ['Name (A → Z)', 'Name (Z → A)'],
	},
	'pt-BR': {
		measures: { count: 'Contagem de linhas', sum: 'Soma de coluna numérica', mean: 'Média de coluna numérica' },
		all: 'Todas',
		sorts: {
			count: ['Contagem (maior → menor)', 'Contagem (menor → maior)'],
			sum: ['Soma (maior → menor)', 'Soma (menor → maior)'],
			mean: ['Média (maior → menor)', 'Média (menor → maior)'],
		},
		names: ['Nome (A → Z)', 'Nome (Z → A)'],
	},
};

const columns = [
	{ name: 'region', type: 'text' },
	{ name: 'team', type: 'text' },
	{ name: 'sales', type: 'number' },
	{ name: 'profit', type: 'number' },
];
const rows = [{ region: 'North', team: 'A', sales: 1, profit: 2 }];
const context = {
	allColumns: ['region', 'team', 'sales', 'profit'],
	numeric: ['sales', 'profit'],
	categorical: ['region', 'team'],
	baseCategoricalOrAll: ['region', 'team'],
	dates: [],
};

function datasetWith(type, overrides = {}) {
	const chartConfig = createDefaultChartConfig();
	chartConfig[type] = { ...chartConfig[type], enabled: true, category: 'team', ...overrides };
	return { rows, columns, chartConfig };
}

// Build a chart's described controls into the document, wired to a writer
// double, as the controls sidebar does.
function mount(type, overrides) {
	const dataset = datasetWith(type, overrides);
	const writer = { commit: vi.fn(), preview: vi.fn() };
	document.body.replaceChildren(...buildDescribedControls(
		getChartControlAdapter(type).controls,
		{ dataset, context, writer, translate: t },
	));
	return writer;
}

const optionsOf = id => [...document.getElementById(id).options].map(option => [option.value, option.textContent]);

describe.each(['en', 'pt-BR'])('data control labels in %s', language => {
	beforeEach(() => {
		locale.value = language;
	});

	it.each(TYPES)('the %s measure select offers its measures by their long labels', type => {
		mount(type);
		expect(optionsOf(`viz-select-${type}-measure`))
			.toEqual(MEASURES[type].map(measure => [measure, LABELS[language].measures[measure]]));
	});

	it.each(TYPES)('the %s Top-N select offers all categories, then Top 10, 20 and 50', type => {
		mount(type);
		expect(optionsOf(`viz-select-${type}-topn`))
			.toEqual([['0', LABELS[language].all], ['10', 'Top 10'], ['20', 'Top 20'], ['50', 'Top 50']]);
	});

	it.each(MEASURES.bar)('bar names its measure, %s, in the sort options', measureMode => {
		mount('bar', { measureMode, valueColumn: measureMode === 'count' ? null : 'sales' });
		const [descending, ascending] = LABELS[language].sorts[measureMode];
		const [byName, byNameReversed] = LABELS[language].names;
		expect(optionsOf('viz-select-bar-sort')).toEqual([
			['value-desc', descending],
			['value-asc', ascending],
			['label-asc', byName],
			['label-desc', byNameReversed],
		]);
	});
});

describe('data control rules', () => {
	beforeEach(() => {
		locale.value = 'en';
	});

	it.each(TYPES.flatMap(type => MEASURES[type].map(measure => [type, measure])))(
		'the %s value column select is disabled under %s only for count',
		(type, measureMode) => {
			mount(type, { measureMode, valueColumn: 'sales' });
			expect(document.getElementById(`viz-select-${type}-value-column`).disabled).toBe(measureMode === 'count');
		},
	);

	it.each(TYPES)('the %s value column select stores only a visible numeric column', type => {
		const writer = mount(type, { measureMode: 'sum', valueColumn: 'sales' });
		const select = document.getElementById(`viz-select-${type}-value-column`);
		const choose = value => {
			select.value = value;
			select.dispatchEvent(new Event('change'));
			return writer.commit.mock.lastCall[0];
		};
		expect(choose('profit')).toEqual({ valueColumn: 'profit' });
		expect(choose('')).toEqual({ valueColumn: null });
		select.append(new Option('region', 'region'));
		expect(choose('region')).toEqual({ valueColumn: null });
	});

	describe.each(TYPES)('%s activation defaults', type => {
		const defaults = (overrides, ctx = context) =>
			getChartControlAdapter(type).computeDefaults(datasetWith(type, overrides), ctx);

		it('keep a visible category, else take the first one', () => {
			expect(defaults({ category: 'team' }).category).toBe('team');
			expect(defaults({ category: 'gone' }).category).toBe('region');
			expect(defaults({ category: 'gone' }, { ...context, baseCategoricalOrAll: [] }).category).toBeNull();
		});

		it('keep the value column for count and a visible numeric one for sum, else take the first numeric column', () => {
			expect(defaults({ measureMode: 'count', valueColumn: 'hidden' }).valueColumn).toBe('hidden');
			expect(defaults({ measureMode: 'sum', valueColumn: 'profit' }).valueColumn).toBe('profit');
			expect(defaults({ measureMode: 'sum', valueColumn: 'hidden' }).valueColumn).toBe('sales');
			expect(defaults({ measureMode: 'sum', valueColumn: 'hidden' }, { ...context, numeric: [] }).valueColumn).toBeNull();
		});
	});
});
