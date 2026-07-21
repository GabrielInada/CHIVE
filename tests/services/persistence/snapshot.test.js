import { describe, expect, it } from 'vitest';
import { normalizeStoredSnapshot } from '../../../src/services/persistence/snapshot.js';

describe('persistence snapshot normalization', () => {
	it('filters and de-duplicates selected columns against declared columns', () => {
		const normalized = normalizeStoredSnapshot({
			data: {
				activeDatasetId: 'dataset-1',
				datasets: [{
					id: 'dataset-1',
					name: 'data.csv',
					rows: [{ a: 1, b: 2 }],
					columns: [{ name: 'a', type: 'number' }, { name: 'b', type: 'number' }],
					selectedColumns: ['b', 'missing', 'b', null, 'a'],
					chartConfig: {},
				}],
			},
		});

		expect(normalized.data.datasets[0].selectedColumns).toEqual(['b', 'a']);
		expect(normalized.data.activeIndex).toBe(0);
	});
});
