import { describe, expect, it } from 'vitest';
import { normalizeStoredSnapshot } from '../../../src/services/persistence/snapshot.js';
import { STATS_CATEGORICAL_VERSION, STATS_NUMERIC_VERSION } from '../../../src/config/statistics.js';
import { CELL_FORMAT_VERSION } from '../../../src/domain/datasets/cellValues.js';

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

	describe('precomputed stats invalidation', () => {
		// Numbers produced by an older calculateStatistics can carry a string
		// min or a zero-skewed mean, and older categories keyed dates by text
		// that canonical cells no longer match, so a version mismatch drops the
		// stale part and statsView recomputes it.
		const CURRENT_STATS = {
			numericVersion: STATS_NUMERIC_VERSION,
			categoricalVersion: STATS_CATEGORICAL_VERSION,
			numeric: NUMERIC_STATS,
			categorical: CATEGORICAL_STATS,
		};

		it.each([
			['a stale version', 0],
			['no version at all', undefined],
		])('drops numeric stats carrying %s while keeping categorical', (_label, numericVersion) => {
			const normalized = normalizeStoredSnapshot(snapshotWith({ ...CURRENT_STATS, numericVersion }));

			const stats = normalized.data.datasets[0].precomputedStats;
			expect('numeric' in stats).toBe(false);
			expect(stats.categorical).toEqual(CATEGORICAL_STATS);
		});

		it.each([
			['a stale version', 0],
			['no version at all', undefined],
		])('drops categorical stats carrying %s while keeping numeric', (_label, categoricalVersion) => {
			const normalized = normalizeStoredSnapshot(snapshotWith({ ...CURRENT_STATS, categoricalVersion }));

			const stats = normalized.data.datasets[0].precomputedStats;
			expect('categorical' in stats).toBe(false);
			expect(stats.numeric).toEqual(NUMERIC_STATS);
		});

		it('keeps stats written by the current implementation', () => {
			const normalized = normalizeStoredSnapshot(snapshotWith(CURRENT_STATS));

			expect(normalized.data.datasets[0].precomputedStats).toEqual(CURRENT_STATS);
		});

		it('leaves a record without precomputed stats alone', () => {
			const normalized = normalizeStoredSnapshot(snapshotWith(undefined));
			const record = normalized.data.datasets[0];

			// Not merely undefined: the key must not be introduced.
			expect('precomputedStats' in record).toBe(false);
		});
	});

	describe('cell canonicalization', () => {
		const COLUMNS = [
			{ name: 'n', type: 'number' },
			{ name: 't', type: 'text' },
			{ name: 'd', type: 'date' },
		];
		// Rows as projects saved before canonical cells stored them: blanks kept
		// as empty strings, dates as the instants of UTC-3 midnights.
		const LEGACY_ROWS = [
			{ n: '', t: 'x', d: '2024-01-15T03:00:00.000Z' },
			{ n: 2, t: '   ', d: '2024-07-15T03:00:00.000Z' },
		];
		const CANONICAL_ROWS = [
			{ n: null, t: 'x', d: '2024-01-15' },
			{ n: 2, t: null, d: '2024-07-15' },
		];

		function storedWith({ rows, cellFormatVersion, charts }) {
			return {
				cellFormatVersion,
				data: {
					activeDatasetId: 'dataset-1',
					datasets: [{ id: 'dataset-1', name: 'data.csv', rows, columns: COLUMNS, selectedColumns: [], chartConfig: {} }],
				},
				panel: charts ? { charts } : null,
			};
		}

		it('canonicalizes the rows of a project saved before canonical cells', () => {
			const normalized = normalizeStoredSnapshot(storedWith({ rows: LEGACY_ROWS }));

			expect(normalized.data.datasets[0].rows).toEqual(CANONICAL_ROWS);
		});

		it('keeps the rows of a current project, date-times included', () => {
			const rows = [
				{ n: 1, t: 'x', d: '2024-01-15T03:00:00.000Z' },
				{ n: 2, t: 'y', d: '2024-07-15T03:00:00.000Z' },
			];
			const normalized = normalizeStoredSnapshot(storedWith({ rows, cellFormatVersion: CELL_FORMAT_VERSION }));

			expect(normalized.data.datasets[0].rows).toBe(rows);
		});

		it('canonicalizes panel captures without a transformPanel', () => {
			const chart = { id: 0, type: 'bar', dataSnapshot: LEGACY_ROWS, columnsSnapshot: COLUMNS };
			const normalized = normalizeStoredSnapshot(storedWith({ rows: [], charts: [chart] }));

			expect(normalized.panel.charts[0].dataSnapshot).toEqual(CANONICAL_ROWS);
			expect(chart.dataSnapshot).toBe(LEGACY_ROWS);
		});

		it('reads only the well-formed columns of a capture', () => {
			const chart = {
				id: 0,
				dataSnapshot: [{ n: 1, d: '' }],
				columnsSnapshot: [null, { name: 'n' }, { name: 'd', type: 'date' }],
			};
			const normalized = normalizeStoredSnapshot(storedWith({ rows: [], charts: [chart] }));

			expect(normalized.panel.charts[0].dataSnapshot).toEqual([{ n: 1, d: null }]);
		});
	});
});
