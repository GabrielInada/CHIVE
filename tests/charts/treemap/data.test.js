import { describe, expect, it } from 'vitest';
import { aggregateTreemapData } from '../../../src/charts/treemap/data.js';
import { MISSING_KEY } from '../../../src/domain/datasets/cellValues.js';

const countArgs = { measureMode: 'count', valueColumn: null, topN: 0, missingLabel: '(missing)' };
const sumArgs = { measureMode: 'sum', valueColumn: 'v', topN: 0, missingLabel: '(missing)' };
const pairs = entries => entries.map(entry => [entry.key, entry.value]);

describe('aggregateTreemapData', () => {
	it('measures categories through the shared category aggregation', () => {
		const rows = [{ c: 'A', v: 10 }, { c: 'A', v: null }, { c: null, v: 4 }];
		const result = aggregateTreemapData(rows, 'c', { ...sumArgs, missingLabel: '(sem valor)' });
		expect(result.entries.map(({ key, label, value }) => [key, label, value]))
			.toEqual([['A', 'A', 10], [MISSING_KEY, '(sem valor)', 4]]);
		expect(result.total).toBe(14);
	});

	it('passes the shared failures through', () => {
		expect(aggregateTreemapData([{ c: 'A' }], 'c', { ...sumArgs, valueColumn: null }))
			.toEqual({ ok: false, reason: 'no-value-column' });
		expect(aggregateTreemapData([{ c: 'A', v: null }], 'c', sumArgs))
			.toEqual({ ok: false, reason: 'no-numeric' });
		expect(aggregateTreemapData([], 'c', countArgs)).toEqual({ ok: false });
	});

	it('drops categories whose summed value is not > 0', () => {
		const rows = [{ c: 'A', v: 5 }, { c: 'B', v: 0 }, { c: 'C', v: -3 }];
		expect(pairs(aggregateTreemapData(rows, 'c', sumArgs).entries)).toEqual([['A', 5]]);
	});

	it('fails with no-positive-value when no category has a positive value', () => {
		const rows = [{ c: 'A', v: 0 }, { c: 'B', v: -2 }];
		expect(aggregateTreemapData(rows, 'c', sumArgs)).toEqual({ ok: false, reason: 'no-positive-value' });
	});

	it('trims to Top-N and computes total over the trimmed entries (post-trim base)', () => {
		const rows = [
			{ c: 'A' }, { c: 'A' }, { c: 'A' }, // 3
			{ c: 'B' }, { c: 'B' },             // 2
			{ c: 'C' },                          // 1
		];
		const result = aggregateTreemapData(rows, 'c', { ...countArgs, topN: 2 });
		expect(pairs(result.entries)).toEqual([['A', 3], ['B', 2]]);
		// total is 5 (rendered cells), NOT 6 (all rows): the percentage base is post-trim.
		expect(result.total).toBe(5);
	});
});
