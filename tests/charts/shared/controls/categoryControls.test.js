// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { measureControl, topNControl, valueColumnControl } from '../../../../src/charts/shared/controls/categoryControls.js';
import { buildDescribedControls } from '../../../../src/charts/shared/controls/describedControls.js';

const translate = (key, ...params) => `t(${[key, ...params].join(', ')})`;

const CONTEXT = {
	allColumns: ['region', 'sales', 'profit'],
	numeric: ['sales', 'profit'],
	categorical: ['region'],
	baseCategoricalOrAll: ['region'],
	dates: [],
	rows: [],
};

function build(controls, config = {}) {
	const dataset = { chartConfig: { demo: { enabled: true, measureMode: 'count', valueColumn: null, topN: 10, ...config } } };
	const writer = { commit: vi.fn(), preview: vi.fn() };
	const root = document.createElement('div');
	root.append(...buildDescribedControls(
		{ definition: { key: 'demo', allowedValues: { measureMode: ['count', 'sum', 'mean'] } }, sections: [{ id: 'data', title: 'Data', controls }] },
		{ dataset, context: CONTEXT, writer, translate },
	));
	return { writer, dataset, get: id => root.querySelector(`#${id}`) };
}

function change(select, value) {
	select.value = value;
	select.dispatchEvent(new Event('change', { bubbles: true }));
}

const optionsOf = select => [...select.options].map(option => [option.value, option.textContent]);

describe('category chart control descriptions', () => {
	it('offers the measures the chart definition lists, under the chart\'s id', () => {
		const { get } = build([measureControl('demo-measure')], { measureMode: 'sum' });

		expect(optionsOf(get('demo-measure'))).toEqual([
			['count', 't(chive-chart-control-measure-count)'],
			['sum', 't(chive-chart-control-measure-sum)'],
			['mean', 't(chive-chart-control-measure-mean)'],
		]);
		expect(get('demo-measure').value).toBe('sum');
		expect(get('demo-measure').previousElementSibling.textContent).toBe('t(chive-chart-control-measure)');
	});

	it('writes the measure with the value column it keeps, read when the measure changes', () => {
		const { get, writer, dataset } = build([measureControl('demo-measure')], { valueColumn: 'old' });

		change(get('demo-measure'), 'sum');
		expect(writer.commit).toHaveBeenLastCalledWith({ measureMode: 'sum', valueColumn: 'sales' });

		dataset.chartConfig = { demo: { ...dataset.chartConfig.demo, valueColumn: 'profit' } };
		change(get('demo-measure'), 'count');
		expect(writer.commit).toHaveBeenLastCalledWith({ measureMode: 'count', valueColumn: 'profit' });
	});

	it('offers "None" and the numeric columns for the value column, disabled while the measure counts', () => {
		const counting = build([valueColumnControl('demo-value')], { measureMode: 'count', valueColumn: 'sales' });
		expect(optionsOf(counting.get('demo-value'))).toEqual([['', 't(chive-chart-option-none)'], ['sales', 'sales'], ['profit', 'profit']]);
		expect(counting.get('demo-value').disabled).toBe(true);

		const summing = build([valueColumnControl('demo-value')], { measureMode: 'sum', valueColumn: 'profit' });
		expect(summing.get('demo-value').disabled).toBe(false);
		expect(summing.get('demo-value').value).toBe('profit');
	});

	it('stores a value column only while it is a visible numeric column', () => {
		const { get, writer } = build([valueColumnControl('demo-value')], { measureMode: 'sum' });

		change(get('demo-value'), 'profit');
		expect(writer.commit).toHaveBeenLastCalledWith({ valueColumn: 'profit' });
		change(get('demo-value'), '');
		expect(writer.commit).toHaveBeenLastCalledWith({ valueColumn: null });

		get('demo-value').append(new Option('region', 'region'));
		change(get('demo-value'), 'region');
		expect(writer.commit).toHaveBeenLastCalledWith({ valueColumn: null });
	});

	it('offers "All" and each Top-N limit under the chart\'s label, and stores a number', () => {
		const { get, writer } = build([topNControl({ id: 'demo-topn', label: 'chive-demo-topn', topNOptions: [0, 10, 25] })], { topN: 25 });

		expect(optionsOf(get('demo-topn'))).toEqual([['0', 't(chive-chart-topn-all)'], ['10', 'Top 10'], ['25', 'Top 25']]);
		expect(get('demo-topn').value).toBe('25');
		expect(get('demo-topn').previousElementSibling.textContent).toBe('t(chive-demo-topn)');

		change(get('demo-topn'), '10');
		expect(writer.commit).toHaveBeenCalledWith({ topN: 10 });
	});
});
