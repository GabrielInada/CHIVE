// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openGlobalFilterDialog } from '../../../src/components/results/globalFilterDialog.js';

const translate = key => key;

const rows = [
	{ region: 'North', age: 18 },
	{ region: 'North', age: 22 },
	{ region: 'South', age: 30 },
	{ region: 'East', age: 50 },
	{ region: null, age: null },
];

const allColumns = ['region', 'age'];
const numericColumns = ['age'];

beforeEach(() => {
	document.body.innerHTML = '';
});

afterEach(() => {
	// Clean up any stray overlays.
	document.querySelectorAll('.gf-overlay').forEach(el => el.remove());
});

describe('openGlobalFilterDialog', () => {
	it('opens dialog into DOM and shows column selector', () => {
		openGlobalFilterDialog({
			rows,
			allColumns,
			numericColumns,
			initialFilter: { column: null },
			translate,
		});

		const dialog = document.querySelector('.gf-dialog');
		expect(dialog).not.toBeNull();
		const columnSelect = document.getElementById('gf-column');
		expect(columnSelect).not.toBeNull();
		const optionValues = Array.from(columnSelect.options).map(opt => opt.value);
		expect(optionValues).toContain('region');
		expect(optionValues).toContain('age');
	});

	it('Cancel resolves with cancel action and removes overlay', async () => {
		const pending = openGlobalFilterDialog({
			rows,
			allColumns,
			numericColumns,
			initialFilter: { column: null },
			translate,
		});

		document.getElementById('gf-cancel').click();
		const result = await pending;
		expect(result.action).toBe('cancel');
		expect(result.filter).toBeNull();
		expect(document.querySelector('.gf-overlay')).toBeNull();
	});

	it('Apply returns the current draft filter', async () => {
		const pending = openGlobalFilterDialog({
			rows,
			allColumns,
			numericColumns,
			initialFilter: { column: null },
			translate,
		});

		const columnSelect = document.getElementById('gf-column');
		columnSelect.value = 'age';
		columnSelect.dispatchEvent(new Event('change'));

		const opSelect = document.getElementById('gf-operator');
		opSelect.value = 'gt';
		opSelect.dispatchEvent(new Event('change'));

		const valueInput = document.getElementById('gf-value');
		valueInput.value = '25';
		valueInput.dispatchEvent(new Event('input'));

		document.getElementById('gf-apply').click();

		const result = await pending;
		expect(result.action).toBe('apply');
		expect(result.filter.column).toBe('age');
		expect(result.filter.operator).toBe('gt');
		expect(result.filter.value).toBe('25');
	});

	it('Clear returns default filter config', async () => {
		const pending = openGlobalFilterDialog({
			rows,
			allColumns,
			numericColumns,
			initialFilter: { column: 'region', mode: 'categorical', include: ['v:North'] },
			translate,
		});

		document.getElementById('gf-clear').click();
		const result = await pending;
		expect(result.action).toBe('clear');
		expect(result.filter.column).toBeNull();
		expect(result.filter.include).toEqual([]);
	});

	it('Escape key discards edits and cancels', async () => {
		const pending = openGlobalFilterDialog({
			rows,
			allColumns,
			numericColumns,
			initialFilter: { column: null },
			translate,
		});

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		const result = await pending;
		expect(result.action).toBe('cancel');
	});

	it('clicking on overlay closes as cancel', async () => {
		const pending = openGlobalFilterDialog({
			rows,
			allColumns,
			numericColumns,
			initialFilter: { column: null },
			translate,
		});

		const overlay = document.querySelector('.gf-overlay');
		overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		// Overlay click must hit overlay itself, not the dialog — simulate direct target.
		overlay.click();
		const result = await pending;
		expect(result.action).toBe('cancel');
	});

	it('auto-resets when initialFilter references a missing column', () => {
		openGlobalFilterDialog({
			rows,
			allColumns: ['region'],
			numericColumns: [],
			initialFilter: { column: 'gone', mode: 'categorical', include: ['v:x'] },
			translate,
		});

		const columnSelect = document.getElementById('gf-column');
		expect(columnSelect.value).toBe('');
	});
});
