import { describe, expect, it } from 'vitest';
import { categoryTickValues } from '../../../src/charts/shared/axisTicks.js';

describe('categorical labels on narrow charts', () => {
	it('retains both ends without changing the plotted domain', () => {
		const domain = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
		expect(categoryTickValues(domain, 200)).toEqual(['A', 'E', 'H']);
		expect(domain).toHaveLength(8);
	});

	it('retains all labels when there is enough room', () => {
		expect(categoryTickValues(['A', 'B', 'C'], 700)).toEqual(['A', 'B', 'C']);
		expect(categoryTickValues([], 200)).toEqual([]);
		expect(categoryTickValues(['A'], 200)).toEqual(['A']);
	});
});
