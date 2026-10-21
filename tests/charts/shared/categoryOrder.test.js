import { describe, expect, it } from 'vitest';
import { compareCategoryKeys, compareStrings } from '../../../src/charts/shared/categoryOrder.js';
import { MISSING_KEY } from '../../../src/domain/datasets/cellValues.js';

describe('compareStrings', () => {
	it('orders by locale and tolerates nullish input', () => {
		expect(['b', 'a', 'c'].sort(compareStrings)).toEqual(['a', 'b', 'c']);
		expect(() => compareStrings(undefined, null)).not.toThrow();
	});
});

describe('compareCategoryKeys', () => {
	it('sorts the missing bucket last in ascending order', () => {
		const keys = ['b', MISSING_KEY, 'a', 'N/A'];
		expect(keys.sort((a, b) => compareCategoryKeys(a, b))).toEqual(['a', 'b', 'N/A', MISSING_KEY]);
	});

	it('sorts the missing bucket last in descending order too', () => {
		const keys = ['b', MISSING_KEY, 'a'];
		expect(keys.sort((a, b) => compareCategoryKeys(a, b, -1))).toEqual(['b', 'a', MISSING_KEY]);
	});

	it('treats two missing keys as equal', () => {
		expect(compareCategoryKeys(MISSING_KEY, MISSING_KEY)).toBe(0);
	});
});
