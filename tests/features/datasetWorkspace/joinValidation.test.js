import { describe, expect, it } from 'vitest';
import {
	joinValidationMessageKey,
	validateJoinSpec,
} from '../../../src/features/datasetWorkspace/joinValidation.js';

const left = { name: 'left.csv', columns: [{ name: 'id' }, { name: 'region' }] };
const right = { name: 'right.csv', columns: [{ name: 'user_id' }, { name: 'score' }] };
const datasets = [left, right];

function spec(overrides = {}) {
	return { leftIndex: 0, rightIndex: 1, leftKeys: ['id'], rightKeys: ['user_id'], ...overrides };
}

describe('validateJoinSpec', () => {
	it.each([
		['a non-array dataset list', null],
		['an empty dataset list', []],
		['a single dataset', [left]],
	])('requires two files for %s', (_label, input) => {
		expect(validateJoinSpec(input, spec())).toEqual({ ok: false, reason: 'min-files' });
	});

	it.each([
		['a missing spec', undefined],
		['non-numeric indexes', { leftIndex: 'a', rightIndex: 1 }],
		['an out-of-range index', { leftIndex: 0, rightIndex: 5 }],
		['a negative index', { leftIndex: -1, rightIndex: 1 }],
	])('rejects %s as an invalid file selection', (_label, input) => {
		expect(validateJoinSpec(datasets, input)).toEqual({ ok: false, reason: 'invalid-file-selection' });
	});

	it('rejects joining a file with itself, even when indexes arrive as strings', () => {
		expect(validateJoinSpec(datasets, spec({ leftIndex: '1', rightIndex: 1 })))
			.toEqual({ ok: false, reason: 'same-file' });
	});

	it.each([
		['missing left keys', { leftKeys: undefined }],
		['empty right keys', { rightKeys: [] }],
		['only blank keys', { leftKeys: ['', null], rightKeys: ['user_id'] }],
	])('requires keys on both sides when given %s', (_label, overrides) => {
		expect(validateJoinSpec(datasets, spec(overrides))).toEqual({ ok: false, reason: 'keys-required' });
	});

	it('requires the same number of keys on each side after dropping blanks', () => {
		expect(validateJoinSpec(datasets, spec({ leftKeys: ['id', 'region'], rightKeys: ['user_id', ''] })))
			.toEqual({ ok: false, reason: 'key-count-mismatch' });
	});

	it('requires at least one output column across both sides', () => {
		expect(validateJoinSpec(datasets, spec({ leftColumns: [], rightColumns: [''] })))
			.toEqual({ ok: false, reason: 'columns-required' });
	});

	it('treats a dataset without columns as contributing none when columns are omitted', () => {
		const bare = [{ name: 'a' }, { name: 'b' }];
		expect(validateJoinSpec(bare, spec())).toEqual({ ok: false, reason: 'columns-required' });
	});

	it('selects every source column when the column arrays are omitted', () => {
		const result = validateJoinSpec(datasets, spec({ leftIndex: '0', rightIndex: '1' }));

		expect(result).toEqual({
			ok: true,
			leftIndex: 0,
			rightIndex: 1,
			leftDataset: left,
			rightDataset: right,
			leftKeys: ['id'],
			rightKeys: ['user_id'],
			leftColumns: ['id', 'region'],
			rightColumns: ['user_id', 'score'],
		});
	});

	it('keeps explicit column choices, dropping blanks, and allows one side to be empty', () => {
		const result = validateJoinSpec(datasets, spec({ leftColumns: ['region', ''], rightColumns: [] }));

		expect(result).toMatchObject({ ok: true, leftColumns: ['region'], rightColumns: [] });
	});
});

describe('joinValidationMessageKey', () => {
	it.each([
		['min-files', 'chive-join-error-min-files'],
		['invalid-file-selection', 'chive-join-error-invalid-file-selection'],
		['same-file', 'chive-join-error-select-different-files'],
		['keys-required', 'chive-join-error-keys-required'],
		['key-count-mismatch', 'chive-join-error-key-count-mismatch'],
		['columns-required', 'chive-join-error-columns-required'],
	])('maps %s to its message key', (reason, key) => {
		expect(joinValidationMessageKey(reason)).toBe(key);
	});

	it('falls back to the generic message for unknown reasons', () => {
		expect(joinValidationMessageKey('nope')).toBe('chive-join-error-generic');
		expect(joinValidationMessageKey(undefined)).toBe('chive-join-error-generic');
	});
});
