// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clearPersistedState,
	configurePersistenceBackend,
	exportProject,
	hydrateState,
	importProjectBytes,
	persistState,
} from '../../src/services/persistence.js';
import {
	goodRecord,
	makeBackend,
	makeSnapshot,
	writeLegacyState,
} from './persistence.testSupport.js';
import { STATS_CATEGORICAL_VERSION, STATS_NUMERIC_VERSION } from '../../src/config/statistics.js';
import { calculateCategoricalStatistics } from '../../src/domain/datasets/statistics.js';
import { mergePanelSnapshotConfigsWithDefaults } from '../../src/domain/panel/rehydration.js';

describe('persistence', () => {
	beforeEach(async () => {
		configurePersistenceBackend(makeBackend());
		await clearPersistedState();
		localStorage.clear();
	});

	afterEach(async () => {
		await clearPersistedState();
		localStorage.clear();
		configurePersistenceBackend(null);
	});

	it('imports the legacy raw IndexedDB stores once when no SQLite blob exists', async () => {
		await writeLegacyState({
			datasets: [goodRecord('legacy')],
			panelRecord: {
				activeDatasetId: 'legacy',
				charts: [],
				slots: {},
				layout: 'template-2col',
				blocks: [],
				nextBlockId: 1,
				nextChartId: 0,
			},
		});
		const applyStateSnapshot = vi.fn();

		await hydrateState({ applyStateSnapshot });

		expect(applyStateSnapshot).toHaveBeenCalledTimes(1);
		expect(applyStateSnapshot.mock.calls[0][0].data.datasets[0].id).toBe('legacy');
		expect(localStorage.getItem('chive.migrated')).toBe('1');

		const secondReplace = vi.fn();
		await hydrateState({ applyStateSnapshot: secondReplace });
		expect(secondReplace).toHaveBeenCalledTimes(1);
		expect(secondReplace.mock.calls[0][0].data.datasets[0].id).toBe('legacy');
	});

	it('drops stale stats coming in through the legacy import path', async () => {
		// Legacy records predate versioning entirely, so their cached numeric
		// stats were produced by the implementation that counted blank cells, and
		// their categorical stats from cells that were not yet canonical.
		await writeLegacyState({
			datasets: [{
				...goodRecord('legacy-stats'),
				precomputedStats: {
					numeric: [{ name: 'x', n: 3, min: '', max: 20, mean: 5, median: 5 }],
					categorical: [{ name: 'label', n: 2, missing: 1, unique: 2, mode: 'a' }],
				},
			}],
			panelRecord: {
				activeDatasetId: 'legacy-stats',
				charts: [],
				slots: {},
				layout: 'template-2col',
				blocks: [],
				nextBlockId: 1,
				nextChartId: 0,
			},
		});
		const applyStateSnapshot = vi.fn();

		await hydrateState({ applyStateSnapshot });

		const stats = applyStateSnapshot.mock.calls[0][0].data.datasets[0].precomputedStats;
		expect('numeric' in stats).toBe(false);
		expect('categorical' in stats).toBe(false);
	});

	it('canonicalizes legacy rows and captures, and saves them in the current format', async () => {
		// Old IndexedDB projects stored dates as Date objects at local midnight
		// (UTC-3 here) and kept blank cells as empty strings.
		const columns = [{ name: 'x', type: 'number' }, { name: 'd', type: 'date' }];
		const legacyRows = [
			{ x: 1, d: new Date('2024-01-15T03:00:00.000Z') },
			{ x: '', d: new Date('2024-07-15T03:00:00.000Z') },
		];
		const canonicalRows = [{ x: 1, d: '2024-01-15' }, { x: null, d: '2024-07-15' }];
		await writeLegacyState({
			datasets: [{ ...goodRecord('legacy-cells'), rows: legacyRows, columns, selectedColumns: ['x', 'd'] }],
			panelRecord: {
				activeDatasetId: 'legacy-cells',
				charts: [{ id: 0, type: 'bar', config: {}, dataSnapshot: legacyRows, columnsSnapshot: columns }],
				slots: {},
				layout: 'template-2col',
				blocks: [],
				nextBlockId: 1,
				nextChartId: 1,
			},
		});

		const migrated = vi.fn();
		await hydrateState({ applyStateSnapshot: migrated });
		const reloaded = vi.fn();
		await hydrateState({ applyStateSnapshot: reloaded });

		for (const applyStateSnapshot of [migrated, reloaded]) {
			const restored = applyStateSnapshot.mock.calls[0][0];
			expect(restored.data.datasets[0].rows).toEqual(canonicalRows);
			expect(restored.panel.charts[0].dataSnapshot).toEqual(canonicalRows);
		}
	});

	it.each(['browser reload', 'project import', 'legacy IndexedDB'])(
		'preserves saved sorts and numeric stats while discarding version 1 categorical stats on %s',
		async entryPoint => {
			const rows = [{ x: 1, label: 'A' }, { x: 2, label: null }];
			const columns = [{ name: 'x', type: 'number' }, { name: 'label', type: 'text' }];
			const numeric = [{ name: 'x', n: 2, min: 1, max: 2, mean: 1.5, median: 1.5 }];
			const saved = makeSnapshot({
				data: {
					activeIndex: 0,
					datasets: [{
						...goodRecord('legacy-names'),
						rows,
						columns,
						selectedColumns: ['x', 'label'],
						chartConfig: { bar: { category: 'label', measureMode: 'mean', valueColumn: 'x', sort: 'count-asc' } },
						precomputedStats: {
							numericVersion: STATS_NUMERIC_VERSION,
							categoricalVersion: 1,
							numeric,
							categorical: [{ name: 'label', n: 1, missing: 1, missingPct: 0.5, unique: 1, uniquenessRate: 1, mode: 'A', modeCount: 1, modePct: 1, top5Pct: 1, empty: false }],
						},
					}],
				},
			});
			saved.panel.charts = ['count-asc', 'count-desc'].map((sort, id) => ({
				id,
				type: 'bar',
				config: { category: 'label', measureMode: 'sum', valueColumn: 'x', sort },
				dataSnapshot: rows,
				columnsSnapshot: columns,
			}));
			saved.panel.nextChartId = 2;
			const applyStateSnapshot = vi.fn();
			const hooks = { applyStateSnapshot, transformPanel: mergePanelSnapshotConfigsWithDefaults };

			if (entryPoint === 'project import') {
				const exported = await exportProject(saved);
				expect(exported.ok).toBe(true);
				expect((await importProjectBytes(exported.bytes, hooks)).ok).toBe(true);
			} else {
				if (entryPoint === 'legacy IndexedDB') {
					await writeLegacyState({
						datasets: saved.data.datasets,
						panelRecord: { ...saved.panel, activeDatasetId: 'legacy-names' },
					});
				} else {
					expect((await persistState(saved)).ok).toBe(true);
				}
				await hydrateState(hooks);
			}

			expect(applyStateSnapshot).toHaveBeenCalledTimes(1);
			const restored = applyStateSnapshot.mock.calls[0][0];
			const dataset = restored.data.datasets[0];
			expect(dataset.rows).toEqual(rows);
			expect(dataset.precomputedStats.numeric).toEqual(numeric);
			expect(dataset.precomputedStats).not.toHaveProperty('categorical');
			expect(dataset.chartConfig.bar).toMatchObject({ sort: 'value-asc', measureMode: 'mean', valueColumn: 'x' });
			expect(restored.panel.charts.map(chart => chart.config.sort)).toEqual(['value-asc', 'value-desc']);
			for (const chart of restored.panel.charts) {
				expect(chart.dataSnapshot).toEqual(rows);
				expect(chart.config).toMatchObject({ measureMode: 'sum', valueColumn: 'x' });
			}
			expect(calculateCategoricalStatistics(dataset.rows, dataset.columns)[0])
				.toMatchObject({ missingFraction: 0.5, modeFraction: 1, top5Fraction: 1 });

			// Autosave writes the normalized names; the next reload keeps them.
			expect((await persistState(restored)).ok).toBe(true);
			const reloaded = vi.fn();
			await hydrateState({ applyStateSnapshot: reloaded, transformPanel: mergePanelSnapshotConfigsWithDefaults });
			// SQLite adds fingerprint metadata on the first save of legacy records.
			expect(reloaded.mock.calls[0][0].data).toMatchObject(restored.data);
			expect(reloaded.mock.calls[0][0].data.datasets[0].precomputedStats).not.toHaveProperty('categorical');
			expect(reloaded.mock.calls[0][0].panel).toEqual(restored.panel);
		},
	);

	it('round-trips current-version stats through SQLite unchanged', async () => {
		const precomputedStats = {
			numericVersion: STATS_NUMERIC_VERSION,
			categoricalVersion: STATS_CATEGORICAL_VERSION,
			numeric: [{ name: 'x', n: 1, min: 1, max: 1, mean: 1, median: 1 }],
			categorical: [{ name: 'label', n: 1, missing: 0, missingFraction: 0, unique: 1, uniquenessRate: 1, mode: 'A', modeCount: 1, modeFraction: 1, top5Fraction: 1, empty: false }],
		};

		await persistState(makeSnapshot({
			data: {
				activeDatasetId: 'kept',
				datasets: [{
					...goodRecord('kept'),
					rows: [{ x: 1, label: 'A' }],
					columns: [{ name: 'x', type: 'number' }, { name: 'label', type: 'text' }],
					precomputedStats,
				}],
			},
		}));

		const applyStateSnapshot = vi.fn();
		await hydrateState({ applyStateSnapshot });

		expect(applyStateSnapshot.mock.calls[0][0].data.datasets[0].precomputedStats)
			.toEqual(precomputedStats);
	});

	it('clearPersistedState removes project/UI state, sets the legacy tombstone, and keeps browser preferences', async () => {
		localStorage.setItem('chive.ui', JSON.stringify({ sidebarMode: 'panel', previewRows: 20 }));
		localStorage.setItem('chive-locale', 'en');
		localStorage.setItem('chive.settings', JSON.stringify({ tinColorRendering: 'full-ramp' }));
		await persistState(makeSnapshot());

		await clearPersistedState();

		expect(localStorage.getItem('chive.ui')).toBeNull();
		expect(localStorage.getItem('chive-locale')).toBe('en');
		expect(JSON.parse(localStorage.getItem('chive.settings'))).toEqual({ tinColorRendering: 'full-ramp' });
		expect(localStorage.getItem('chive.migrated')).toBe('1');
		const applyStateSnapshot = vi.fn();
		await hydrateState({ applyStateSnapshot });
		expect(applyStateSnapshot).not.toHaveBeenCalled();
	});
});
