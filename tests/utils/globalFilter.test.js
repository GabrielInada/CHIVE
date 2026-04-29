import { describe, expect, it } from 'vitest';
import {
	applyGlobalFilterRules,
	countGlobalFilterRules,
	createEmptyGlobalFilter,
	createSingleCategoryGlobalFilter,
	excludeTokenFromFilter,
	getTokenFilterState,
	isGlobalFilterActive,
	isShowOnlyThisRedundant,
	mergeIncludeTokenIntoFilter,
	normalizeGlobalFilter,
	removeExcludeTokenFromFilter,
	removeIncludeTokenFromFilter,
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

	describe('createSingleCategoryGlobalFilter', () => {
		it('creates a one-rule categorical filter for the supplied column and token', () => {
			const filter = createSingleCategoryGlobalFilter('region', 'v:North');
			expect(filter.combine).toBe('AND');
			expect(filter.rules).toEqual([
				{ column: 'region', mode: 'categorical', include: ['v:North'] },
			]);
		});

		it('falls back to an empty filter when the column or token is invalid', () => {
			expect(createSingleCategoryGlobalFilter('', 'v:North').rules).toEqual([]);
			expect(createSingleCategoryGlobalFilter('region', '').rules).toEqual([]);
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

		it('removes token from exclude when adding to include', () => {
			const initial = { rules: [{ column: 'region', mode: 'categorical', include: [], exclude: ['v:North'] }] };
			const merged = mergeIncludeTokenIntoFilter(initial, 'region', 'v:North');
			expect(merged.rules[0].include).toEqual(['v:North']);
			expect(merged.rules[0].exclude).toEqual([]);
		});
	});

	describe('excludeTokenFromFilter', () => {
		it('creates a new categorical rule with the token in exclude when no rule exists', () => {
			const next = excludeTokenFromFilter(createEmptyGlobalFilter(), 'region', 'v:North');
			expect(next.rules).toHaveLength(1);
			expect(next.rules[0].column).toBe('region');
			expect(next.rules[0].mode).toBe('categorical');
			expect(next.rules[0].include).toEqual([]);
			expect(next.rules[0].exclude).toEqual(['v:North']);
		});

		it('appends to exclude on an existing categorical rule', () => {
			const initial = { rules: [{ column: 'region', mode: 'categorical', include: [], exclude: ['v:North'] }] };
			const next = excludeTokenFromFilter(initial, 'region', 'v:South');
			expect(next.rules[0].exclude).toEqual(['v:North', 'v:South']);
		});

		it('does not duplicate a token already excluded', () => {
			const initial = { rules: [{ column: 'region', mode: 'categorical', include: [], exclude: ['v:North'] }] };
			const next = excludeTokenFromFilter(initial, 'region', 'v:North');
			expect(next.rules[0].exclude).toEqual(['v:North']);
		});

		it('removes token from include when adding to exclude', () => {
			const initial = { rules: [{ column: 'region', mode: 'categorical', include: ['v:North', 'v:South'], exclude: [] }] };
			const next = excludeTokenFromFilter(initial, 'region', 'v:North');
			expect(next.rules[0].include).toEqual(['v:South']);
			expect(next.rules[0].exclude).toEqual(['v:North']);
		});

		it('returns the filter unchanged for invalid column or token', () => {
			const initial = { rules: [{ column: 'region', mode: 'categorical', include: ['v:North'], exclude: [] }] };
			expect(excludeTokenFromFilter(initial, '', 'v:X').rules[0].exclude).toEqual([]);
			expect(excludeTokenFromFilter(initial, 'region', '').rules[0].exclude).toEqual([]);
		});
	});

	describe('removeIncludeTokenFromFilter', () => {
		it('removes a token from include', () => {
			const initial = { rules: [{ column: 'region', mode: 'categorical', include: ['v:North', 'v:South'], exclude: [] }] };
			const next = removeIncludeTokenFromFilter(initial, 'region', 'v:North');
			expect(next.rules[0].include).toEqual(['v:South']);
		});

		it('drops the rule entirely when both arrays end up empty', () => {
			const initial = { rules: [{ column: 'region', mode: 'categorical', include: ['v:North'], exclude: [] }] };
			const next = removeIncludeTokenFromFilter(initial, 'region', 'v:North');
			expect(next.rules).toEqual([]);
		});

		it('keeps the rule when exclude still has entries', () => {
			const initial = { rules: [{ column: 'region', mode: 'categorical', include: ['v:North'], exclude: ['v:East'] }] };
			const next = removeIncludeTokenFromFilter(initial, 'region', 'v:North');
			expect(next.rules).toHaveLength(1);
			expect(next.rules[0].include).toEqual([]);
			expect(next.rules[0].exclude).toEqual(['v:East']);
		});

		it('is a no-op when the token is not in include', () => {
			const initial = { rules: [{ column: 'region', mode: 'categorical', include: ['v:North'], exclude: [] }] };
			const next = removeIncludeTokenFromFilter(initial, 'region', 'v:Other');
			expect(next.rules[0].include).toEqual(['v:North']);
		});
	});

	describe('removeExcludeTokenFromFilter', () => {
		it('removes a token from exclude', () => {
			const initial = { rules: [{ column: 'region', mode: 'categorical', include: [], exclude: ['v:North', 'v:South'] }] };
			const next = removeExcludeTokenFromFilter(initial, 'region', 'v:North');
			expect(next.rules[0].exclude).toEqual(['v:South']);
		});

		it('drops the rule when both arrays end up empty', () => {
			const initial = { rules: [{ column: 'region', mode: 'categorical', include: [], exclude: ['v:North'] }] };
			const next = removeExcludeTokenFromFilter(initial, 'region', 'v:North');
			expect(next.rules).toEqual([]);
		});
	});

	describe('getTokenFilterState', () => {
		it('returns null when no rule for column', () => {
			expect(getTokenFilterState({ rules: [] }, 'region', 'v:North')).toBeNull();
		});

		it('returns "included" when token is in include', () => {
			const filter = { rules: [{ column: 'region', mode: 'categorical', include: ['v:North'], exclude: [] }] };
			expect(getTokenFilterState(filter, 'region', 'v:North')).toBe('included');
		});

		it('returns "excluded" when token is in exclude', () => {
			const filter = { rules: [{ column: 'region', mode: 'categorical', include: [], exclude: ['v:North'] }] };
			expect(getTokenFilterState(filter, 'region', 'v:North')).toBe('excluded');
		});

		it('prefers excluded when token is somehow in both arrays', () => {
			const filter = { rules: [{ column: 'region', mode: 'categorical', include: ['v:North'], exclude: ['v:North'] }] };
			expect(getTokenFilterState(filter, 'region', 'v:North')).toBe('excluded');
		});

		it('returns null for missing column or token', () => {
			const filter = { rules: [{ column: 'region', mode: 'categorical', include: ['v:North'], exclude: [] }] };
			expect(getTokenFilterState(filter, '', 'v:North')).toBeNull();
			expect(getTokenFilterState(filter, 'region', '')).toBeNull();
		});
	});

	describe('isShowOnlyThisRedundant', () => {
		it('returns true on an empty filter (Show only this would equal Add)', () => {
			expect(isShowOnlyThisRedundant(createEmptyGlobalFilter(), 'region', 'v:N')).toBe(true);
			expect(isShowOnlyThisRedundant(null, 'region', 'v:N')).toBe(true);
		});

		it('returns true when the only rule is this column with include=[token]', () => {
			const filter = { rules: [{ column: 'region', mode: 'categorical', include: ['v:N'], exclude: [] }] };
			expect(isShowOnlyThisRedundant(filter, 'region', 'v:N')).toBe(true);
		});

		it('returns true when the only rule is this column with exclude=[token]', () => {
			const filter = { rules: [{ column: 'region', mode: 'categorical', include: [], exclude: ['v:N'] }] };
			expect(isShowOnlyThisRedundant(filter, 'region', 'v:N')).toBe(true);
		});

		it('returns false when there are rules for other columns', () => {
			const filter = {
				rules: [
					{ column: 'region', mode: 'categorical', include: ['v:N'], exclude: [] },
					{ column: 'age', mode: 'numeric', operator: 'gt', value: '20' },
				],
			};
			expect(isShowOnlyThisRedundant(filter, 'region', 'v:N')).toBe(false);
		});

		it('returns false when this column has more than one included token', () => {
			const filter = { rules: [{ column: 'region', mode: 'categorical', include: ['v:N', 'v:S'], exclude: [] }] };
			expect(isShowOnlyThisRedundant(filter, 'region', 'v:N')).toBe(false);
		});

		it('returns false when this column has an exclude for a different token', () => {
			const filter = { rules: [{ column: 'region', mode: 'categorical', include: ['v:N'], exclude: ['v:E'] }] };
			expect(isShowOnlyThisRedundant(filter, 'region', 'v:N')).toBe(false);
		});

		it('returns false for invalid input', () => {
			expect(isShowOnlyThisRedundant(createEmptyGlobalFilter(), '', 'v:N')).toBe(false);
			expect(isShowOnlyThisRedundant(createEmptyGlobalFilter(), 'region', '')).toBe(false);
		});
	});

	describe('applyGlobalFilterRules with exclude', () => {
		const rows = [
			{ region: 'North', age: 18 },
			{ region: 'North', age: 30 },
			{ region: 'South', age: 45 },
			{ region: 'East', age: 55 },
		];

		it('drops rows whose token is in exclude when include is empty', () => {
			const filter = {
				rules: [{ column: 'region', mode: 'categorical', include: [], exclude: ['v:North'] }],
			};
			expect(applyGlobalFilterRules(rows, filter)).toEqual([
				{ region: 'South', age: 45 },
				{ region: 'East', age: 55 },
			]);
		});

		it('drops rows in exclude even when they would otherwise match include', () => {
			const filter = {
				rules: [{ column: 'region', mode: 'categorical', include: ['v:North', 'v:South'], exclude: ['v:North'] }],
			};
			expect(applyGlobalFilterRules(rows, filter)).toEqual([
				{ region: 'South', age: 45 },
			]);
		});
	});
});
