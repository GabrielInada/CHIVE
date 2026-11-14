// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../src/i18n/en.json';
import { ingestDataset } from '../../../src/domain/datasets/ingest.js';
import { getColumnCurrenciesByName } from '../../../src/domain/datasets/columns.js';
import { addDataset, applyStateSnapshot, getActiveDataset, setDatasetColumnCurrency } from '../../../src/state/appState.js';
import { renderTablePreview } from '../../../src/features/datasetWorkspace/views/tablePreviewView.js';
import { renderNumericStats } from '../../../src/features/datasetWorkspace/views/statsView.js';
import { openCurrencyDialog } from '../../../src/features/datasetWorkspace/dialogs/currencyDialog.js';
import { CHART_DEFINITIONS } from '../../../src/config/charts/definitions.js';
import { getPanelChartRenderer } from '../../../src/charts/registries/panel.js';
import { clearChartContainer } from '../../../src/charts/shared/containerLifecycle.js';
import { hideChartTooltip } from '../../../src/charts/shared/tooltip/tooltip.js';
import { VIEW_IDS, BADGE_IDS } from '../../../src/features/datasetWorkspace/domIds.js';

const language = vi.hoisted(() => ({ locale: 'pt-BR' }));
vi.mock('../../../src/services/i18nService.js', () => ({
	t: (key, ...params) => (en[key] ?? key).replace(/\$(\d+)/g, (_, n) => String(params[n - 1])),
	getLocale: () => language.locale,
	translateType: type => type,
}));

const t = (key, ...params) => (en[key] ?? key).replace(/\$(\d+)/g, (_, n) => String(params[n - 1]));
const money = value => new Intl.NumberFormat(language.locale, { style: 'currency', currency: 'BRL' }).format(value);

function load(text = 'category;amount\nA;R$ 1.234,56\nB;R$ 20,00') {
	const payload = ingestDataset({ kind: 'csv', text }).value;
	const dataset = { ...payload, id: 'money', name: 'money.csv', selectedColumns: payload.columns.map(column => column.name), chartConfig: {} };
	addDataset(dataset);
	return dataset;
}

beforeEach(() => {
	language.locale = 'pt-BR';
	applyStateSnapshot({ data: { datasets: [], activeIndex: -1 } });
	document.body.innerHTML = `<div id="${VIEW_IDS.tableContainer}"></div><div id="${VIEW_IDS.statsCard}"><div id="${BADGE_IDS.numColumns}"></div><div id="${VIEW_IDS.statsContainer}"></div></div><div id="chart"></div>`;
});

afterEach(() => {
	clearChartContainer(document.getElementById('chart'));
	hideChartTooltip();
	document.querySelector('dialog')?.dispatchEvent(new Event('cancel', { cancelable: true }));
});

describe('currency workflow', () => {
	it('shows cents and currency in table/statistics while keeping counts plain across languages', () => {
		const dataset = load();
		renderTablePreview(dataset.rows, dataset.columns, 10);
		renderNumericStats(dataset.rows, dataset.columns);
		expect(document.querySelector('tbody').textContent).toContain(money(1234.56));
		expect(document.querySelector('tfoot').textContent).toContain('Currency (BRL)');
		expect(document.querySelector('.stat-col').textContent).toContain(money(627.28));
		expect(document.querySelector('.stat-row').textContent).not.toContain('R$');
		language.locale = 'en-US';
		renderTablePreview(dataset.rows, dataset.columns, 10);
		expect(document.querySelector('tbody').textContent).toContain(money(1234.56));
		expect(dataset.rows[0].amount).toBe(1234.56);
	});

	it('resolves an ambiguous column through the accessible editor and real state writer', () => {
		const dataset = load('category;amount\nA;$ 1.234,56\nB;$ 20,00');
		const column = dataset.columns.find(item => item.name === 'amount');
		expect(column.type).toBe('text');
		openCurrencyDialog({ column, rows: dataset.rows, translate: t, locale: 'pt-BR', onApply: options => setDatasetColumnCurrency(dataset.id, column.name, options) });
		const select = document.querySelector('select[name="currency"]');
		expect(select.labels).toHaveLength(1);
		select.value = 'USD';
		select.dispatchEvent(new Event('change'));
		expect(document.querySelector('.currency-preview').textContent).toContain('1.234,56');
		document.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
		expect(document.querySelector('dialog')).toBeNull();
		expect(getActiveDataset().rows[0].amount).toBe(1234.56);
		expect(getColumnCurrenciesByName(dataset.columns)).toEqual({ amount: 'USD' });
	});

	it('keeps the editor open and data intact when currencies conflict', () => {
		const dataset = load('category;amount\nA;BRL 10,00\nB;USD 20,00');
		const oldRows = dataset.rows;
		openCurrencyDialog({ column: dataset.columns[1], rows: dataset.rows, translate: t, locale: 'pt-BR', onApply: options => setDatasetColumnCurrency(dataset.id, 'amount', options) });
		document.querySelector('select[name="currency"]').value = 'BRL';
		document.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
		expect(document.querySelector('dialog[open]')).not.toBeNull();
		expect(document.querySelector('[role="alert"]').textContent).toContain('conflicting currencies');
		expect(dataset.rows).toBe(oldRows);
	});

	it('cancels the editor without changing values or metadata', () => {
		const dataset = load();
		const onApply = vi.fn();
		openCurrencyDialog({ column: dataset.columns[1], rows: dataset.rows, translate: t, locale: 'pt-BR', onApply });
		document.querySelector('dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
		expect(onApply).not.toHaveBeenCalled();
		expect(document.querySelector('dialog')).toBeNull();
	});

	it.each(['bar', 'pie', 'treemap', 'bubble'])('preserves the currency in %s panel captures and keeps counts plain', type => {
		const dataset = load();
		const container = document.getElementById('chart');
		const config = { ...CHART_DEFINITIONS[type].createDefaultConfig(), category: 'category', valueColumn: 'amount', measureMode: 'sum', showLegend: true, showValueLabel: true, showValues: true };
		const draw = getPanelChartRenderer(type);
		const snapshot = { config, dataSnapshot: dataset.rows, columnsSnapshot: dataset.columns };
		expect(draw(container, snapshot).ok).toBe(true);
		expect(container.textContent).toContain('R$');
		if (type === 'pie') expect(container.textContent).toContain(money(1234.56));
		draw(container, { ...snapshot, config: { ...config, measureMode: 'count' } });
		expect(container.textContent).not.toContain('R$');
	});

	it.each(['line', 'scatter'])('formats %s axes using the captured column currency', type => {
		const dataset = load('x;amount\n1;R$ 1.234,56\n2;R$ 20,00');
		const config = { ...CHART_DEFINITIONS[type].createDefaultConfig(), x: 'x', y: 'amount' };
		const container = document.getElementById('chart');
		const draw = getPanelChartRenderer(type);
		expect(draw(container, { config, dataSnapshot: dataset.rows, columnsSnapshot: dataset.columns }).ok).toBe(true);
		expect(container.textContent).toContain('R$');
		if (type === 'line') {
			draw(container, { config: { ...config, aggregateMode: 'count' }, dataSnapshot: dataset.rows, columnsSnapshot: dataset.columns });
			expect(container.textContent).not.toContain('R$');
		}
	});
});
