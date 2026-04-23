import { describe, expect, it } from 'vitest';
import { isGlobalFilterActive, resolveGlobalFilterForColumns } from '../../src/utils/globalFilter.js';

describe('globalFilter utils', () => {
	describe('isGlobalFilterActive', () => {
		it('returns false when filter is null/undefined', () => {
			expect(isGlobalFilterActive(null)).toBe(false);
			expect(isGlobalFilterActive(undefined)).toBe(false);
		});

		it('returns false when column is missing or empty', () => {
			expect(isGlobalFilterActive({})).toBe(false);
			expect(isGlobalFilterActive({ column: '' })).toBe(false);
			expect(isGlobalFilterActive({ column: '   ' })).toBe(false);
		});

		it('returns true when column is a non-empty string', () => {
			expect(isGlobalFilterActive({ column: 'region' })).toBe(true);
		});
	});

	describe('resolveGlobalFilterForColumns', () => {
		it('returns default when filter is null', () => {
			const resolved = resolveGlobalFilterForColumns(null, ['a']);
			expect(resolved.column).toBeNull();
		});

		it('resets filter when referenced column is missing', () => {
			const filter = { column: 'gone', include: ['v:x'], mode: 'categorical' };
			const resolved = resolveGlobalFilterForColumns(filter, ['age', 'region']);
			expect(resolved.column).toBeNull();
			expect(resolved.include).toEqual([]);
		});

		it('preserves filter when column is available', () => {
			const filter = { column: 'region', include: ['v:N'], mode: 'categorical' };
			const resolved = resolveGlobalFilterForColumns(filter, ['region']);
			expect(resolved).toBe(filter);
		});
	});
});
