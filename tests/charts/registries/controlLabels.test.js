// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getChartControlAdapter } from '../../../src/charts/registries/controls.js';
import { buildDescribedControls } from '../../../src/charts/shared/controls/describedControls.js';
import { createDefaultChartConfig } from '../../../src/config/charts/defaults.js';
import { setLocale, t } from '../../../src/services/i18nService.js';

const sections = {
	bar: ['Category (bar chart)', 'Display', 'Styling', 'Advanced'],
	bubble: ['Category (bubble chart)', 'Display', 'Styling'],
	line: ['Data & Aggregation', 'Styling', 'Display'],
	network: ['Data & Aggregation', 'Display', 'Styling', 'Advanced'],
	pie: ['Data & Aggregation', 'Display', 'Styling'],
	scatter: ['Data & Aggregation', 'Display', 'Trendline', 'Styling'],
	scatter3d: ['Data', 'Display', 'Styling'],
	tin: ['Data', 'Display', 'Surface', 'Overlays'],
	treemap: ['Category', 'Display', 'Styling', 'Advanced'],
};

const portuguese = {
	Category: 'Categoria',
	'Category (bar chart)': 'Categoria (barras)',
	'Category (bubble chart)': 'Categoria (bubble)',
	Data: 'Dados',
	'Data & Aggregation': 'Dados e agregação',
	Display: 'Exibição',
	Styling: 'Estilo',
	Advanced: 'Avançado',
	Surface: 'Superfície',
	Overlays: 'Sobreposições',
	Trendline: 'Linha de tendência',
};

describe.each(['en', 'pt-BR'])('chart section labels in %s', locale => {
	beforeEach(async () => {
		await setLocale(locale);
	});

	afterEach(() => {
		document.body.replaceChildren();
		localStorage.clear();
	});

	it.each(Object.entries(sections))('translates every %s section through the real catalog', (type, titles) => {
		const dataset = { rows: [], columns: [], chartConfig: createDefaultChartConfig() };
		const context = {
			allColumns: [], numeric: [], categorical: [], baseCategoricalOrAll: [], dates: [], rows: [],
		};
		document.body.replaceChildren(...buildDescribedControls(getChartControlAdapter(type).controls, {
			dataset, context, writer: { commit() {}, preview() {} }, translate: t,
		}));

		const rendered = Array.from(document.querySelectorAll('.chart-section-title'), node => node.textContent.trim());
		expect(rendered).toEqual(locale === 'en' ? titles : titles.map(title => portuguese[title]));
	});
});
