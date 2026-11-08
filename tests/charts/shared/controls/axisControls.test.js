// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { numericAxisControl } from '../../../../src/charts/shared/controls/axisControls.js';
import { buildDescribedControls } from '../../../../src/charts/shared/controls/describedControls.js';

const AXIS = numericAxisControl({ id: 'demo-x', key: 'x', label: 'chive-x' });

function createContext(numeric = ['width', 'height']) {
	const allColumns = ['name', ...numeric];
	return { allColumns, numeric, categorical: ['name'], baseCategoricalOrAll: ['name'], dates: [], rows: [] };
}

function build(config, context = createContext()) {
	const dataset = { chartConfig: { demo: { enabled: true, ...config } } };
	const writer = { commit: vi.fn(), preview: vi.fn() };
	const root = document.createElement('div');
	root.append(...buildDescribedControls(
		{ definition: { key: 'demo', allowedValues: {} }, sections: [{ id: 'data', title: 'Data', controls: [AXIS] }] },
		{ dataset, context, writer, translate: key => key },
	));
	return { writer, select: root.querySelector('#demo-x') };
}

function choose(select, value) {
	if (![...select.options].some(option => option.value === value)) select.append(new Option(value, value));
	select.value = value;
	select.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('numericAxisControl', () => {
	it('offers "None" and the numeric columns, and shows the axis', () => {
		const { select } = build({ x: 'height' });

		expect([...select.options].map(option => option.value)).toEqual(['', 'width', 'height']);
		expect(select.value).toBe('height');
	});

	it('shows "None" for any falsy axis, even beside columns named "0" and "false"', () => {
		const context = createContext(['0', 'false', 'width']);

		for (const x of [null, undefined, '', 0, false, Number.NaN]) {
			expect(build({ x }, context).select.selectedIndex, String(x)).toBe(0);
		}
	});

	it('stores a numeric column, and null for "None" or any other option', () => {
		const { select, writer } = build({ x: 'width' });

		choose(select, 'height');
		expect(writer.commit).toHaveBeenLastCalledWith({ x: 'height' });
		choose(select, '');
		expect(writer.commit).toHaveBeenLastCalledWith({ x: null });
		choose(select, 'name');
		expect(writer.commit).toHaveBeenLastCalledWith({ x: null });
	});
});
