// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openGlobalFilterDialog } from '../../../src/components/results/globalFilterDialog.js';

const translate = (key, ...args) => {
	if (args.length === 0) return key;
	return `${key}:${args.join(',')}`;
};

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
	document.querySelectorAll('.gf-overlay').forEach(el => el.remove());
});

describe('openGlobalFilterDialog (multi-rule)', () => {
	it('opens an empty rules state when initial filter has no rules', () => {
		openGlobalFilterDialog({
			rows,
			allColumns,
			numericColumns,
			initialFilter: { rules: [] },
			translate,
		});

		expect(document.querySelector('.gf-dialog')).not.toBeNull();
		expect(document.querySelector('.gf-add-rule')).not.toBeNull();
		expect(document.querySelector('.gf-rule-card')).toBeNull();
	});

	it('adds a new empty rule card when Add rule is clicked', () => {
		openGlobalFilterDialog({
			rows,
			allColumns,
			numericColumns,
			initialFilter: { rules: [] },
			translate,
		});

		document.querySelector('.gf-add-rule').click();
		expect(document.querySelectorAll('.gf-rule-card').length).toBe(1);

		document.querySelector('.gf-add-rule').click();
		expect(document.querySelectorAll('.gf-rule-card').length).toBe(2);
	});

	it('removes a specific rule when its remove button is clicked', () => {
		openGlobalFilterDialog({
			rows,
			allColumns,
			numericColumns,
			initialFilter: {
				rules: [
					{ column: 'region', mode: 'categorical', include: ['v:North'] },
					{ column: 'age', mode: 'numeric', operator: 'gt', value: '20' },
				],
			},
			translate,
		});

		expect(document.querySelectorAll('.gf-rule-card').length).toBe(2);
		const removeButtons = document.querySelectorAll('.gf-rule-remove');
		removeButtons[0].click();
		expect(document.querySelectorAll('.gf-rule-card').length).toBe(1);
	});

	it('Clear all closes with empty rules', async () => {
		const pending = openGlobalFilterDialog({
			rows,
			allColumns,
			numericColumns,
			initialFilter: {
				rules: [{ column: 'region', mode: 'categorical', include: ['v:North'] }],
			},
			translate,
		});

		document.querySelector('.gf-clear-all').click();
		const result = await pending;
		expect(result.action).toBe('clear');
		expect(result.filter.rules).toEqual([]);
		expect(result.filter.combine).toBe('AND');
	});

	it('Apply returns only fully-formed rules', async () => {
		const pending = openGlobalFilterDialog({
			rows,
			allColumns,
			numericColumns,
			initialFilter: { rules: [] },
			translate,
		});

		document.querySelector('.gf-add-rule').click();
		const columnSelect = document.querySelector('.gf-rule-card .gf-rule-column');
		columnSelect.value = 'age';
		columnSelect.dispatchEvent(new Event('change'));

		const opSelect = document.querySelector('.gf-rule-card .gf-rule-operator');
		opSelect.value = 'gt';
		opSelect.dispatchEvent(new Event('change'));
		const valueInput = document.querySelector('.gf-rule-card input[type="number"]');
		valueInput.value = '25';
		valueInput.dispatchEvent(new Event('input'));

		// Add a second (incomplete) rule — should be skipped in the final output.
		document.querySelector('.gf-add-rule').click();

		document.querySelector('.gf-apply').click();
		const result = await pending;
		expect(result.action).toBe('apply');
		expect(result.filter.rules).toHaveLength(1);
		expect(result.filter.rules[0].column).toBe('age');
		expect(result.filter.rules[0].operator).toBe('gt');
		expect(result.filter.rules[0].value).toBe('25');
	});

	it('Cancel discards unsaved draft edits', async () => {
		const pending = openGlobalFilterDialog({
			rows,
			allColumns,
			numericColumns,
			initialFilter: { rules: [] },
			translate,
		});

		document.querySelector('.gf-add-rule').click();
		document.querySelector('.gf-cancel').click();
		const result = await pending;
		expect(result.action).toBe('cancel');
		expect(result.filter).toBeNull();
	});

	it('Escape cancels without applying changes', async () => {
		const pending = openGlobalFilterDialog({
			rows,
			allColumns,
			numericColumns,
			initialFilter: { rules: [] },
			translate,
		});

		document.querySelector('.gf-add-rule').click();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		const result = await pending;
		expect(result.action).toBe('cancel');
	});

	it('Overlay click cancels', async () => {
		const pending = openGlobalFilterDialog({
			rows,
			allColumns,
			numericColumns,
			initialFilter: { rules: [] },
			translate,
		});

		const overlay = document.querySelector('.gf-overlay');
		overlay.click();
		const result = await pending;
		expect(result.action).toBe('cancel');
	});

	it('drops initial rules referencing missing columns', () => {
		openGlobalFilterDialog({
			rows,
			allColumns: ['region'],
			numericColumns: [],
			initialFilter: {
				rules: [
					{ column: 'gone', mode: 'categorical', include: ['v:x'] },
					{ column: 'region', mode: 'categorical', include: ['v:North'] },
				],
			},
			translate,
		});

		expect(document.querySelectorAll('.gf-rule-card').length).toBe(1);
		const columnSelect = document.querySelector('.gf-rule-card .gf-rule-column');
		expect(columnSelect.value).toBe('region');
	});

	it('migrates legacy single-filter input into one preloaded rule', () => {
		openGlobalFilterDialog({
			rows,
			allColumns,
			numericColumns,
			initialFilter: { column: 'region', mode: 'categorical', include: ['v:North'] },
			translate,
		});

		expect(document.querySelectorAll('.gf-rule-card').length).toBe(1);
	});
});
