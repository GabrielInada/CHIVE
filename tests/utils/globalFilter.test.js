import { describe, expect, it } from 'vitest';
import {
	applyGlobalFilterRules,
	countGlobalFilterRules,
	createEmptyGlobalFilter,
	isGlobalFilterActive,
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
});
