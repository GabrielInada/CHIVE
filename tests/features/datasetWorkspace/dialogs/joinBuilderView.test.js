// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	showError: vi.fn(),
}));

vi.mock('../../../../src/ui/feedback.js', () => ({
	showError: mocks.showError,
}));

import { openJoinBuilderDialog } from '../../../../src/features/datasetWorkspace/dialogs/joinBuilderView.js';

const translate = (key, ...args) => (args.length ? `${key}:${args.join(',')}` : key);

const datasets = [
	{
		name: 'Left.csv',
		rows: [
			{ id: 'A', amount: 10 },
			{ id: 'B', amount: 20 },
			{ id: 'C', amount: 30 },
		],
		columns: [{ name: 'id' }, { name: 'amount' }],
	},
	{
		name: 'Right.csv',
		rows: [
			{ id: 'a', group: 'North' },
			{ id: 'B', group: 'South' },
			{ id: 'B', group: 'East' },
			{ id: 'D', group: 'West' },
		],
		columns: [{ name: 'id' }, { name: 'group' }],
	},
];

function change(node) {
	node.dispatchEvent(new Event('change', { bubbles: true }));
}

function clickCreate() {
	document.querySelector('.join-footer .btn-primary').click();
}

describe('openJoinBuilderDialog', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		vi.clearAllMocks();
	});

	it('returns null and reports an error when fewer than two datasets are available', async () => {
		const result = await openJoinBuilderDialog({
			datasets: [datasets[0]],
			translate,
		});

		expect(result).toBeNull();
		expect(mocks.showError).toHaveBeenCalledWith('chive-join-error-min-files');
		expect(document.querySelector('.join-dialog')).toBeNull();
	});

	it('renders default dataset selections and resolves a valid join spec', async () => {
		const pending = openJoinBuilderDialog({ datasets, translate });

		expect(document.querySelector('.join-dialog')).not.toBeNull();
		expect(document.querySelector('#join-left-file').value).toBe('0');
		expect(document.querySelector('#join-right-file').value).toBe('1');
		expect(document.querySelector('.join-estimate').textContent).toBe('chive-join-estimate-rows:3');

		clickCreate();
		const result = await pending;

		expect(result).toEqual({
			leftIndex: 0,
			rightIndex: 1,
			joinType: 'inner',
			leftKeys: ['id'],
			rightKeys: ['id'],
			leftColumns: ['id', 'amount'],
			rightColumns: ['id', 'group'],
		});
		expect(document.querySelector('.join-dialog')).toBeNull();
	});

	it('updates the estimate as join type and key selections change', () => {
		openJoinBuilderDialog({ datasets, translate });

		const typeSelect = document.querySelector('#join-type');
		typeSelect.value = 'full';
		change(typeSelect);
		expect(document.querySelector('.join-estimate').textContent).toBe('chive-join-estimate-rows:5');

		document.querySelector('#join-left-keys input[value="amount"]').checked = true;
		change(document.querySelector('#join-left-keys input[value="amount"]'));
		expect(document.querySelector('.join-estimate').textContent).toBe('chive-join-estimate-empty');
	});

	it('cancels on footer cancel, Escape, and backdrop click', async () => {
		let pending = openJoinBuilderDialog({ datasets, translate });
		document.querySelector('.join-footer .btn-secondary').click();
		await expect(pending).resolves.toBeNull();

		pending = openJoinBuilderDialog({ datasets, translate });
		document.querySelector('dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
		await expect(pending).resolves.toBeNull();

		pending = openJoinBuilderDialog({ datasets, translate });
		document.querySelector('dialog').click();
		await expect(pending).resolves.toBeNull();
	});

	it('keeps the dialog open and renders inline errors for invalid join specs', () => {
		openJoinBuilderDialog({ datasets, translate });

		const rightSelect = document.querySelector('#join-right-file');
		rightSelect.value = '0';
		change(rightSelect);
		clickCreate();
		expect(document.querySelector('.join-validation-error').textContent)
			.toBe('chive-join-error-select-different-files');
		expect(rightSelect.getAttribute('aria-invalid')).toBe('true');
		expect(document.querySelector('.join-dialog')).not.toBeNull();

		rightSelect.value = '1';
		change(rightSelect);
		const leftKey = document.querySelector('#join-left-keys input[value="id"]');
		leftKey.checked = false;
		change(leftKey);
		clickCreate();
		expect(document.querySelector('.join-validation-error').textContent)
			.toBe('chive-join-error-keys-required');

		leftKey.checked = true;
		change(leftKey);
		const extraLeftKey = document.querySelector('#join-left-keys input[value="amount"]');
		extraLeftKey.checked = true;
		change(extraLeftKey);
		clickCreate();
		expect(document.querySelector('.join-validation-error').textContent)
			.toBe('chive-join-error-key-count-mismatch');

		extraLeftKey.checked = false;
		change(extraLeftKey);
		document.querySelectorAll('#join-left-columns input, #join-right-columns input')
			.forEach(input => { input.checked = false; });
		change(document.querySelector('#join-left-columns input[value="id"]'));
		clickCreate();
		expect(document.querySelector('.join-validation-error').textContent)
			.toBe('chive-join-error-columns-required');
	});
});
