// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clearPersistedState,
	configurePersistenceBackend,
	hydrateState,
	persistState,
} from '../../src/services/persistence.js';
import { goodRecord, makeBackend, makeSnapshot } from './persistence.testSupport.js';

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

	it('persists project state to SQLite and hydrates UI prefs from localStorage', async () => {
		localStorage.setItem('chive.ui', JSON.stringify({ sidebarMode: 'panel', previewRows: 25 }));
		const result = await persistState(makeSnapshot());
		expect(result.ok).toBe(true);

		const replaceAllState = vi.fn();
		await hydrateState({ replaceAllState });

		expect(replaceAllState).toHaveBeenCalledTimes(1);
		const restored = replaceAllState.mock.calls[0][0];
		expect(restored.data.datasets.map(dataset => dataset.id)).toEqual(['ds-1', 'ds-2']);
		expect(restored.data.activeIndex).toBe(1);
		expect(restored.panel.charts[0].dataSnapshot).toEqual([{ y: 2 }]);
		expect(restored.panel.charts[0].columnsSnapshot).toEqual([{ name: 'y', type: 'number' }]);
		expect(restored.ui).toEqual({ sidebarMode: 'panel', previewRows: 25 });
	});

	it('does not write UI prefs as part of persistState', async () => {
		await persistState(makeSnapshot());
		expect(localStorage.getItem('chive.ui')).toBeNull();
	});

	it('does not call replaceAllState on first visit', async () => {
		const replaceAllState = vi.fn();
		await hydrateState({ replaceAllState });
		expect(replaceAllState).not.toHaveBeenCalled();
	});

	it('hydrates UI prefs even when no project has been saved', async () => {
		localStorage.setItem('chive.ui', JSON.stringify({ sidebarMode: 'viz', previewRows: 5 }));
		const replaceAllState = vi.fn();
		await hydrateState({ replaceAllState });
		expect(replaceAllState).toHaveBeenCalledTimes(1);
		expect(replaceAllState.mock.calls[0][0].ui).toEqual({ sidebarMode: 'viz', previewRows: 5 });
	});

	it('ignores malformed UI prefs and invalid replace hooks during hydrate', async () => {
		localStorage.setItem('chive.ui', '{bad json');
		await expect(hydrateState({ replaceAllState: null })).resolves.toBeUndefined();

		const replaceAllState = vi.fn();
		await hydrateState({ replaceAllState });
		expect(replaceAllState).not.toHaveBeenCalled();
	});

	it('applies transformPanel before replaceAllState', async () => {
		await persistState(makeSnapshot());
		const transformPanel = vi.fn(panel => ({
			...panel,
			charts: panel.charts.map(chart => ({ ...chart, config: { ...chart.config, augmented: true } })),
		}));
		const replaceAllState = vi.fn();

		await hydrateState({ replaceAllState, transformPanel });

		expect(transformPanel).toHaveBeenCalledTimes(1);
		expect(replaceAllState.mock.calls[0][0].panel.charts[0].config.augmented).toBe(true);
	});

	it('falls back to the raw panel when transformPanel fails or returns null', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await persistState(makeSnapshot());

		const replaceAfterThrow = vi.fn();
		await hydrateState({
			replaceAllState: replaceAfterThrow,
			transformPanel: () => { throw new Error('transform failed'); },
		});
		expect(replaceAfterThrow.mock.calls[0][0].panel.charts).toHaveLength(1);

		const replaceAfterNull = vi.fn();
		await hydrateState({
			replaceAllState: replaceAfterNull,
			transformPanel: () => null,
		});
		expect(replaceAfterNull.mock.calls[0][0].panel.charts).toHaveLength(1);
		warn.mockRestore();
	});

	it('normalizes malformed stored snapshots at the service boundary', async () => {
		configurePersistenceBackend({
			available: () => true,
			hydrate: async () => ({
				data: {
					activeDatasetId: 'good',
					datasets: [
						{
							id: 'good',
							name: 'good.csv',
							rows: [],
							columns: [{ name: 'x', type: 'number' }],
							selectedColumns: 'bad',
							chartConfig: { bar: { category: 'x' }, scatter: 'bad' },
						},
						'bad',
					],
				},
				panel: { key: 'singleton', activeDatasetId: 'good', charts: [] },
			}),
			persist: vi.fn(),
			clear: vi.fn(),
		});

		const replaceAllState = vi.fn();
		await hydrateState({ replaceAllState });
		const snapshot = replaceAllState.mock.calls[0][0];
		expect(snapshot.data.activeIndex).toBe(0);
		expect(snapshot.data.datasets[0].selectedColumns).toEqual([]);
		const chartConfig = snapshot.data.datasets[0].chartConfig;
		// The bar block is kept and default-filled; the malformed `scatter: 'bad'` is
		// dropped by sanitize then replaced with the default block by canonicalize.
		expect(chartConfig.bar.category).toBe('x');
		expect(chartConfig.scatter).toBeDefined();
		expect(chartConfig.scatter.enabled).toBe(false);
		expect(chartConfig.globalFilter).toEqual({ rules: [], combine: 'AND' });
		expect(snapshot.panel).toEqual({ charts: [] });
	});

	it('bounds a hostile bubble nestingColumns against declared columns at hydrate', async () => {
		configurePersistenceBackend({
			available: () => true,
			hydrate: async () => ({
				data: {
					activeDatasetId: 'good',
					datasets: [
						{
							id: 'good',
							name: 'good.csv',
							rows: [],
							columns: [
								{ name: 'categoria', type: 'text' },
								...Array.from({ length: 10 }, (_, i) => ({ name: `c${i}`, type: 'text' })),
							],
							selectedColumns: [],
							chartConfig: {
								bar: { category: 'x' },
								bubble: {
									category: 'categoria',
									// duplicate, empty, null, the category, an undeclared column,
									// plus more valid columns than the hard cap allows.
									nestingColumns: ['c0', 'c0', '', null, 'categoria', 'undeclared', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9'],
									groupColumn: 'undeclared',
									topN: 20,
								},
							},
						},
					],
				},
				panel: null,
			}),
			persist: vi.fn(),
			clear: vi.fn(),
		});

		const replaceAllState = vi.fn();
		await hydrateState({ replaceAllState });
		const bubble = replaceAllState.mock.calls[0][0].data.datasets[0].chartConfig.bubble;

		// type-clean + de-duplicated + declared-only + category-excluded + capped to 8.
		// (This equality also fails if the implementation spread the raw block AFTER
		// the sanitized fields, re-admitting the unbounded array.)
		expect(bubble.nestingColumns).toEqual(['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7']);
		expect(bubble.nestingColumns).toHaveLength(8);
		expect(bubble.nestingColumns).not.toContain('categoria');
		expect(bubble.nestingColumns).not.toContain('undeclared');
		// legacy pointer kept coherent with the canonical head; benign keys preserved.
		expect(bubble.groupColumn).toBe('c0');
		expect(bubble.topN).toBe(20);
		expect(bubble.category).toBe('categoria');
		// other chart blocks keep their saved fields and are default-filled by canonicalize.
		const bar = replaceAllState.mock.calls[0][0].data.datasets[0].chartConfig.bar;
		expect(bar.category).toBe('x');
		expect(bar.enabled).toBe(false);
	});

	it('keeps a valid legacy groupColumn (and drops an undeclared one) when canonical filters away', async () => {
		configurePersistenceBackend({
			available: () => true,
			hydrate: async () => ({
				data: {
					activeDatasetId: 'good',
					datasets: [
						{
							id: 'good',
							name: 'good.csv',
							rows: [],
							columns: [
								{ name: 'categoria', type: 'text' },
								{ name: 'grupo', type: 'text' },
								{ name: 'regiao', type: 'text' },
							],
							selectedColumns: [],
							chartConfig: {
								bubble: {
									category: 'categoria',
									nestingColumns: ['undeclared1', 'undeclared2'],
									groupColumn: 'grupo',
								},
							},
						},
					],
				},
				panel: null,
			}),
			persist: vi.fn(),
			clear: vi.fn(),
		});

		const replaceAllState = vi.fn();
		await hydrateState({ replaceAllState });
		const bubble = replaceAllState.mock.calls[0][0].data.datasets[0].chartConfig.bubble;

		// The undeclared nesting entries are dropped by sanitize, leaving an empty
		// array with a valid legacy groupColumn; canonicalize then promotes that group
		// into nestingColumns (same rendered result as before, promotion just moves to
		// the restore boundary instead of the first render).
		expect(bubble.nestingColumns).toEqual(['grupo']);
		expect(bubble.groupColumn).toBe('grupo'); // valid legacy retained
	});

	it('drops an undeclared legacy groupColumn to null when canonical is empty', async () => {
		configurePersistenceBackend({
			available: () => true,
			hydrate: async () => ({
				data: {
					activeDatasetId: 'good',
					datasets: [
						{
							id: 'good',
							name: 'good.csv',
							rows: [],
							columns: [
								{ name: 'categoria', type: 'text' },
								{ name: 'grupo', type: 'text' },
							],
							selectedColumns: [],
							chartConfig: {
								bubble: {
									category: 'categoria',
									nestingColumns: [],
									groupColumn: 'undeclared',
								},
							},
						},
					],
				},
				panel: null,
			}),
			persist: vi.fn(),
			clear: vi.fn(),
		});

		const replaceAllState = vi.fn();
		await hydrateState({ replaceAllState });
		const bubble = replaceAllState.mock.calls[0][0].data.datasets[0].chartConfig.bubble;

		expect(bubble.nestingColumns).toEqual([]);
		expect(bubble.groupColumn).toBeNull();
	});

	it('drops malformed hydrated dataset records at the service boundary', async () => {
		configurePersistenceBackend({
			available: () => true,
			hydrate: async () => ({
				data: {
					datasets: [
						goodRecord('keep'),
						{ ...goodRecord('drop-name'), name: 123 },
						{ ...goodRecord('drop-columns'), columns: 'oops' },
						{ ...goodRecord('drop-rows'), rows: null },
					],
					activeDatasetId: 'keep',
				},
				panel: null,
			}),
			persist: vi.fn(),
			clear: vi.fn(),
		});
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const replaceAllState = vi.fn();

		await hydrateState({ replaceAllState });

		expect(warn).toHaveBeenCalledWith(expect.stringContaining('dropped 3 malformed dataset record'));
		const datasets = replaceAllState.mock.calls[0][0].data.datasets;
		expect(datasets).toHaveLength(1);
		const kept = goodRecord('keep');
		expect(datasets[0]).toMatchObject({
			id: kept.id,
			name: kept.name,
			rows: kept.rows,
			columns: kept.columns,
			selectedColumns: kept.selectedColumns,
		});
		// chartConfig is canonicalized ({} -> full default shape) at the restore boundary.
		expect(datasets[0].chartConfig.bar).toBeDefined();
		expect(datasets[0].chartConfig.globalFilter).toEqual({ rules: [], combine: 'AND' });
		warn.mockRestore();
	});
});
