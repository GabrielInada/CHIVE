import { describe, expect, it } from 'vitest';
import { normalizeStoredSnapshot } from '../../../src/services/persistence/snapshot.js';
import { STATS_NUMERIC_VERSION } from '../../../src/config/statistics.js';

const NUMERIC_STATS = [{ name: 'a', n: 1, min: 1, max: 1, mean: 1, median: 1 }];
const CATEGORICAL_STATS = [{ name: 'b', n: 1, missing: 0, unique: 1, mode: 'x' }];

function snapshotWith(precomputedStats) {
	const record = {
		id: 'dataset-1',
		name: 'data.csv',
		rows: [{ a: 1, b: 'x' }],
		columns: [{ name: 'a', type: 'number' }, { name: 'b', type: 'text' }],
		selectedColumns: ['a', 'b'],
		chartConfig: {},
	};
	// Assigned conditionally so the "no stats at all" case genuinely omits the
	// key rather than setting it to undefined.
	if (precomputedStats !== undefined) record.precomputedStats = precomputedStats;
	return { data: { activeDatasetId: 'dataset-1', datasets: [record] } };
}

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

	describe('precomputed numeric stats invalidation', () => {
		// Numbers produced by an older calculateStatistics can carry a string
		// min or a zero-skewed mean, so a version mismatch drops them and
		// statsView recomputes.
		it.each([
			['a stale version', 0],
			['no version at all', undefined],
		])('drops numeric stats carrying %s while keeping categorical', (_label, numericVersion) => {
			const normalized = normalizeStoredSnapshot(snapshotWith({
				numericVersion,
				numeric: NUMERIC_STATS,
				categorical: CATEGORICAL_STATS,
			}));

			const stats = normalized.data.datasets[0].precomputedStats;
			expect(stats.numeric).toBeUndefined();
			expect('numeric' in stats).toBe(false);
			expect(stats.categorical).toEqual(CATEGORICAL_STATS);
		});

		it('keeps numeric stats written by the current implementation', () => {
			const normalized = normalizeStoredSnapshot(snapshotWith({
				numericVersion: STATS_NUMERIC_VERSION,
				numeric: NUMERIC_STATS,
				categorical: CATEGORICAL_STATS,
			}));

			expect(normalized.data.datasets[0].precomputedStats).toEqual({
				numericVersion: STATS_NUMERIC_VERSION,
				numeric: NUMERIC_STATS,
				categorical: CATEGORICAL_STATS,
			});
		});

		it('leaves a record without precomputed stats alone', () => {
			const normalized = normalizeStoredSnapshot(snapshotWith(undefined));
			const record = normalized.data.datasets[0];

			// Not merely undefined: the key must not be introduced.
			expect('precomputedStats' in record).toBe(false);
		});
	});
});
