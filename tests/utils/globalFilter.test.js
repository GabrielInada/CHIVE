import { describe, expect, it } from 'vitest';
import {
	applyGlobalFilterRules,
	countGlobalFilterRules,
	createEmptyGlobalFilter,
	isGlobalFilterActive,
	mergeIncludeTokenIntoFilter,
	normalizeGlobalFilter,
	resolveGlobalFilterForColumns,
} from '../../src/utils/globalFilter.js';

describe('globalFilter utils', () => {
	describe('createEmptyGlobalFilter', () => {
		it('returns an empty rules array and AND combine', () => {
			const empty = createEmptyGlobalFilter();
			expect(empty.rules).toEqual([]);
			expect(empty.combine).toBe('AND');
		});
	});

	describe('normalizeGlobalFilter', () => {
		it('returns empty for null/undefined', () => {
			expect(normalizeGlobalFilter(null).rules).toEqual([]);
			expect(normalizeGlobalFilter(undefined).rules).toEqual([]);
		});

		it('migrates legacy single-filter object to a one-rule array', () => {
			const legacy = { column: 'region', mode: 'categorical', include: ['v:N'] };
			const normalized = normalizeGlobalFilter(legacy);
			expect(normalized.rules).toHaveLength(1);
			expect(normalized.rules[0].column).toBe('region');
			expect(normalized.rules[0].include).toEqual(['v:N']);
		});

		it('migrates legacy filter without column to empty rules', () => {
			const legacy = { column: '', include: [] };
			expect(normalizeGlobalFilter(legacy).rules).toEqual([]);
		});

		it('drops rules that lack a column', () => {
			const raw = { rules: [{ column: 'age' }, { column: '' }, { column: null }] };
			const normalized = normalizeGlobalFilter(raw, ['age']);
			expect(normalized.rules).toHaveLength(1);
			expect(normalized.rules[0].column).toBe('age');
		});

		it('normalizes mode per rule against numeric columns', () => {
			const raw = { rules: [{ column: 'age' }, { column: 'region' }] };
			const normalized = normalizeGlobalFilter(raw, ['age']);
			expect(normalized.rules[0].mode).toBe('numeric');
			expect(normalized.rules[1].mode).toBe('categorical');
		});
	});

	describe('isGlobalFilterActive', () => {
		it('returns false when rules is empty', () => {
			expect(isGlobalFilterActive(null)).toBe(false);
			expect(isGlobalFilterActive({ rules: [] })).toBe(false);
		});

		it('returns true when any rule has a column', () => {
			expect(isGlobalFilterActive({ rules: [{ column: 'age' }] })).toBe(true);
		});

		it('recognizes a legacy single-filter as active', () => {
			expect(isGlobalFilterActive({ column: 'region', include: ['v:x'] })).toBe(true);
		});
	});

	describe('countGlobalFilterRules', () => {
		it('counts rules after normalization', () => {
			expect(countGlobalFilterRules({ rules: [{ column: 'a' }, { column: '' }] })).toBe(1);
			expect(countGlobalFilterRules({ column: 'region' })).toBe(1);
			expect(countGlobalFilterRules(null)).toBe(0);
		});
	});

	describe('resolveGlobalFilterForColumns', () => {
		it('drops rules whose column no longer exists', () => {
			const raw = { rules: [{ column: 'age' }, { column: 'gone' }] };
			const resolved = resolveGlobalFilterForColumns(raw, ['age']);
			expect(resolved.rules).toHaveLength(1);
			expect(resolved.rules[0].column).toBe('age');
		});

		it('returns an empty filter when nothing is left', () => {
			const raw = { rules: [{ column: 'gone' }] };
			const resolved = resolveGlobalFilterForColumns(raw, ['age']);
			expect(resolved.rules).toEqual([]);
		});

		it('accepts legacy single-filter input and resolves safely', () => {
			const legacy = { column: 'region', mode: 'categorical', include: ['v:N'] };
			const resolved = resolveGlobalFilterForColumns(legacy, ['region']);
			expect(resolved.rules).toHaveLength(1);
			expect(resolved.rules[0].column).toBe('region');
		});
	});

	describe('applyGlobalFilterRules', () => {
		const rows = [
			{ region: 'North', age: 18 },
			{ region: 'North', age: 30 },
			{ region: 'South', age: 45 },
			{ region: 'South', age: 55 },
		];

		it('returns rows unchanged when no rules', () => {
			expect(applyGlobalFilterRules(rows, { rules: [] })).toEqual(rows);
		});

		it('combines rules with AND (row must satisfy every rule)', () => {
			const filter = {
				rules: [
					{ column: 'region', mode: 'categorical', include: ['v:North'] },
					{ column: 'age', mode: 'numeric', operator: 'gt', value: '20' },
				],
			};
			expect(applyGlobalFilterRules(rows, filter, ['age'])).toEqual([
				{ region: 'North', age: 30 },
			]);
		});

		it('mixes numeric and categorical rules deterministically', () => {
			const filter = {
				rules: [
					{ column: 'age', mode: 'numeric', operator: 'between', min: '40', max: '60' },
					{ column: 'region', mode: 'categorical', include: ['v:South'] },
				],
			};
			expect(applyGlobalFilterRules(rows, filter, ['age'])).toEqual([
				{ region: 'South', age: 45 },
				{ region: 'South', age: 55 },
			]);
		});

		it('accepts a legacy single-filter as input', () => {
			const legacy = { column: 'region', mode: 'categorical', include: ['v:South'] };
			expect(applyGlobalFilterRules(rows, legacy)).toEqual([
				{ region: 'South', age: 45 },
				{ region: 'South', age: 55 },
			]);
		});

		it('ignores rules with missing column', () => {
			const filter = { rules: [{ column: '' }, { column: 'region', mode: 'categorical', include: ['v:North'] }] };
			expect(applyGlobalFilterRules(rows, filter)).toEqual([
				{ region: 'North', age: 18 },
				{ region: 'North', age: 30 },
			]);
		});
	});

	describe('mergeIncludeTokenIntoFilter', () => {
		it('creates a new categorical rule when no rule for the column exists', () => {
			const merged = mergeIncludeTokenIntoFilter(createEmptyGlobalFilter(), 'region', 'v:North');
			expect(merged.rules).toHaveLength(1);
			expect(merged.rules[0].column).toBe('region');
			expect(merged.rules[0].mode).toBe('categorical');
			expect(merged.rules[0].include).toEqual(['v:North']);
		});

		it('appends a new token to an existing categorical rule for the same column', () => {
			const initial = { rules: [{ column: 'region', mode: 'categorical', include: ['v:North'] }] };
			const merged = mergeIncludeTokenIntoFilter(initial, 'region', 'v:South');
			expect(merged.rules).toHaveLength(1);
			expect(merged.rules[0].include).toEqual(['v:North', 'v:South']);
		});

		it('does not duplicate a token already present in the include list', () => {
			const initial = { rules: [{ column: 'region', mode: 'categorical', include: ['v:North'] }] };
			const merged = mergeIncludeTokenIntoFilter(initial, 'region', 'v:North');
			expect(merged.rules).toHaveLength(1);
			expect(merged.rules[0].include).toEqual(['v:North']);
		});

		it('preserves existing rules for other columns when merging', () => {
			const initial = {
				rules: [
					{ column: 'age', mode: 'numeric', operator: 'gt', value: '20' },
					{ column: 'region', mode: 'categorical', include: ['v:North'] },
				],
			};
			const merged = mergeIncludeTokenIntoFilter(initial, 'region', 'v:South');
			expect(merged.rules).toHaveLength(2);
			expect(merged.rules.find(r => r.column === 'age').operator).toBe('gt');
			expect(merged.rules.find(r => r.column === 'region').include).toEqual(['v:North', 'v:South']);
		});

		it('migrates legacy single-filter input then adds the token', () => {
			const legacy = { column: 'region', mode: 'categorical', include: ['v:North'] };
			const merged = mergeIncludeTokenIntoFilter(legacy, 'region', 'v:South');
			expect(merged.combine).toBe('AND');
			expect(merged.rules).toHaveLength(1);
			expect(merged.rules[0].include).toEqual(['v:North', 'v:South']);
		});

		it('returns the normalized filter unchanged when column or token is missing', () => {
			const initial = { rules: [{ column: 'region', mode: 'categorical', include: ['v:North'] }] };
			const noColumn = mergeIncludeTokenIntoFilter(initial, '', 'v:South');
			const noToken = mergeIncludeTokenIntoFilter(initial, 'region', '');
			expect(noColumn.rules[0].include).toEqual(['v:North']);
			expect(noToken.rules[0].include).toEqual(['v:North']);
		});
	});
});
