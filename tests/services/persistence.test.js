// @vitest-environment jsdom

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import {
	configurePersistenceBackend,
	isPersistenceAvailable,
	hydrateState,
	persistState,
	exportProject,
	importProjectBytes,
	clearPersistedState,
	enablePersistenceAutoSave,
	getPersistenceErrorMessageKey,
	getProjectImportErrorMessageKey,
	isActiveTabOnlyPatch,
	isProjectDirtyEvent,
} from '../../src/services/persistence.js';
import { createBlobBackend } from '../../src/services/persistence/backends/blobBackend.js';
import { emitStateChange, STATE_EVENTS } from '../../src/state/stateEvents.js';

let sqlite3Ready;
let backendCounter = 0;

beforeAll(() => {
	sqlite3Ready = sqlite3InitModule().then(sqlite3 => {
		sqlite3.config.log = () => {};
		sqlite3.config.warn = () => {};
		return sqlite3;
	});
});

function makeBackend() {
	backendCounter += 1;
	return createBlobBackend({
		initSqlite: () => sqlite3Ready,
		dbName: `chive-service-test-${backendCounter}`,
	});
}

function makeSnapshot(overrides = {}) {
	return {
		data: {
			datasets: [
				{
					id: 'ds-1',
					name: 'a.csv',
					rows: [{ x: 1 }],
					columns: [{ name: 'x', type: 'number' }],
					selectedColumns: ['x'],
					chartConfig: {},
				},
				{
					id: 'ds-2',
					name: 'b.csv',
					rows: [{ y: 2 }],
					columns: [{ name: 'y', type: 'number' }],
					selectedColumns: ['y'],
					chartConfig: {},
				},
			],
			activeIndex: 1,
		},
		panel: {
			charts: [{
				id: 0,
				type: 'bar',
				config: { color: '#abc' },
				dataSnapshot: [{ y: 2 }],
				columnsSnapshot: [{ name: 'y', type: 'number' }],
			}],
			slots: {},
			layout: 'template-2col',
			blocks: [{ id: 'block-1', templateId: 'template-2col', slots: {}, proportions: { split: 50 } }],
			nextBlockId: 2,
			nextChartId: 1,
		},
		ui: {
			sidebarMode: 'panel',
			previewRows: 25,
		},
		...overrides,
	};
}

function goodRecord(id = 'good') {
	return {
		id,
		name: `${id}.csv`,
		rows: [{ x: 1 }],
		columns: [{ name: 'x', type: 'number' }],
		selectedColumns: ['x'],
		chartConfig: {},
	};
}

function writeLegacyState({ datasets, panelRecord }) {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open('chive-state', 2);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains('datasets')) {
				db.createObjectStore('datasets', { keyPath: 'id' });
			}
			if (!db.objectStoreNames.contains('panel')) {
				db.createObjectStore('panel', { keyPath: 'key' });
			}
		};
		req.onerror = () => reject(req.error);
		req.onsuccess = () => {
			const db = req.result;
			const tx = db.transaction(['datasets', 'panel'], 'readwrite');
			const dsStore = tx.objectStore('datasets');
			datasets.forEach(dataset => dsStore.put(dataset));
			tx.objectStore('panel').put({ key: 'singleton', ...panelRecord });
			tx.oncomplete = () => {
				db.close();
				resolve();
			};
			tx.onerror = () => {
				db.close();
				reject(tx.error);
			};
		};
	});
}

function setDocumentVisibilityState(value) {
	const original = Object.getOwnPropertyDescriptor(document, 'visibilityState');
	Object.defineProperty(document, 'visibilityState', { configurable: true, value });
	return () => {
		if (original) {
			Object.defineProperty(document, 'visibilityState', original);
		} else {
			delete document.visibilityState;
		}
	};
}

async function flushMicrotasks(count = 3) {
	for (let i = 0; i < count; i += 1) {
		await Promise.resolve();
	}
}

describe('persistence', () => {
	let activeController = null;

	beforeEach(async () => {
		configurePersistenceBackend(makeBackend());
		await clearPersistedState();
		localStorage.clear();
	});

	afterEach(async () => {
		if (activeController) activeController.dispose();
		activeController = null;
		await clearPersistedState();
		localStorage.clear();
		configurePersistenceBackend(null);
	});

	it('exposes exactly the 14 documented exports (no internal leaks through the facade)', async () => {
		const mod = await import('../../src/services/persistence.js');
		expect(Object.keys(mod).sort()).toEqual([
			'PROJECT_FILE_EXTENSION', 'PROJECT_FILE_MIME', 'clearPersistedState',
			'configurePersistenceBackend', 'enablePersistenceAutoSave', 'exportProject',
			'getPersistenceErrorMessageKey', 'getProjectImportErrorMessageKey', 'hydrateState',
			'importProjectBytes', 'isActiveTabOnlyPatch', 'isPersistenceAvailable',
			'isProjectDirtyEvent', 'persistState',
		].sort());
	});

	it('reports availability from the active backend', () => {
		expect(isPersistenceAvailable()).toBe(true);
	});

	it('reports unavailable when backend availability throws or is missing', () => {
		configurePersistenceBackend({
			available: () => { throw new Error('blocked'); },
			hydrate: vi.fn(),
			persist: vi.fn(),
			clear: vi.fn(),
		});
		expect(isPersistenceAvailable()).toBe(false);

		configurePersistenceBackend({
			hydrate: vi.fn(),
			persist: vi.fn(),
			clear: vi.fn(),
		});
		expect(isPersistenceAvailable()).toBe(false);
	});

	it('returns typed failures for invalid snapshots, unavailable storage, and missing import/export hooks', async () => {
		configurePersistenceBackend({
			available: () => false,
			hydrate: vi.fn(),
			persist: vi.fn(),
			clear: vi.fn(),
		});
		await expect(persistState(null)).resolves.toEqual(expect.objectContaining({ ok: false }));
		await expect(persistState(makeSnapshot())).resolves.toEqual(expect.objectContaining({ ok: false }));
		await expect(exportProject(makeSnapshot())).resolves.toEqual(expect.objectContaining({ ok: false }));
		await expect(importProjectBytes(new Uint8Array([1]), { replaceAllState: vi.fn() }))
			.resolves.toEqual(expect.objectContaining({ ok: false }));

		configurePersistenceBackend({
			available: () => true,
			hydrate: vi.fn(),
			persist: vi.fn(),
			clear: vi.fn(),
		});
		await expect(exportProject(null)).resolves.toEqual(expect.objectContaining({ ok: false }));
		await expect(exportProject(makeSnapshot())).resolves.toEqual(expect.objectContaining({ ok: false }));
		await expect(importProjectBytes(new Uint8Array([1]), {})).resolves.toEqual(expect.objectContaining({ ok: false }));
		await expect(importProjectBytes(new Uint8Array([1]), { replaceAllState: vi.fn() }))
			.resolves.toEqual(expect.objectContaining({ ok: false }));
	});

	it('handles backend read/write exceptions without throwing', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		configurePersistenceBackend({
			available: () => true,
			hydrate: vi.fn(async () => { throw new Error('read failed'); }),
			persist: vi.fn(async () => { throw Object.assign(new Error('quota full'), { name: 'QuotaExceededError' }); }),
			exportBytes: vi.fn(async () => { throw 'export failed'; }),
			importBytes: vi.fn(async () => { throw { name: 'UnsupportedProjectFileError', message: 'unsupported chive sqlite' }; }),
			clear: vi.fn(async () => { throw new Error('clear failed'); }),
		});

		const replaceAllState = vi.fn();
		await hydrateState({ replaceAllState });
		expect(replaceAllState).not.toHaveBeenCalled();

		const persist = await persistState(makeSnapshot());
		expect(persist.ok).toBe(false);
		expect(getPersistenceErrorMessageKey(persist.error)).toBe('chive-save-failed-quota');

		const exported = await exportProject(makeSnapshot());
		expect(exported.ok).toBe(false);
		expect(exported.error.message).toBe('export failed');

		const imported = await importProjectBytes(new Uint8Array([1]), { replaceAllState });
		expect(imported.ok).toBe(false);
		expect(getProjectImportErrorMessageKey(imported.error)).toBe('chive-project-import-invalid-error');

		await expect(clearPersistedState()).resolves.toBeUndefined();
		warn.mockRestore();
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

	it('exports full project bytes and imports them as the saved current project', async () => {
		const exported = await exportProject(makeSnapshot());
		expect(exported.ok).toBe(true);
		expect(exported.bytes).toBeInstanceOf(Uint8Array);
		expect(exported.fileName).toMatch(/^chive-project-.*\.chive\.sqlite3$/);

		await clearPersistedState();
		const replaceAllState = vi.fn();
		const transformPanel = vi.fn(panel => ({
			...panel,
			charts: panel.charts.map(chart => ({ ...chart, config: { ...chart.config, imported: true } })),
		}));
		const imported = await importProjectBytes(exported.bytes, { replaceAllState, transformPanel });

		expect(imported.ok).toBe(true);
		expect(replaceAllState).toHaveBeenCalledTimes(1);
		expect(replaceAllState.mock.calls[0][0].data.datasets.map(dataset => dataset.id)).toEqual(['ds-1', 'ds-2']);
		expect(replaceAllState.mock.calls[0][0].panel.charts[0].config.imported).toBe(true);

		const hydratedReplace = vi.fn();
		await hydrateState({ replaceAllState: hydratedReplace });
		expect(hydratedReplace.mock.calls[0][0].data.datasets.map(dataset => dataset.id)).toEqual(['ds-1', 'ds-2']);
	});

	it('rejects work-only project imports in v1', async () => {
		const exported = await exportProject(makeSnapshot(), { workOnly: true });
		expect(exported.ok).toBe(true);
		expect(exported.fileName).toContain('-work-only-');

		const replaceAllState = vi.fn();
		const imported = await importProjectBytes(exported.bytes, { replaceAllState });

		expect(imported.ok).toBe(false);
		expect(getProjectImportErrorMessageKey(imported.error)).toBe('chive-project-import-work-only-error');
		expect(replaceAllState).not.toHaveBeenCalled();
	});

	it('runtime import clears the current panel when the file has no panel doc', async () => {
		const persist = vi.fn(async () => {});
		configurePersistenceBackend({
			available: () => true,
			hydrate: async () => null,
			importBytes: async () => ({
				data: {
					datasets: [goodRecord('only')],
					activeDatasetId: 'only',
				},
				panel: null,
			}),
			persist,
			clear: vi.fn(),
		});
		const replaceAllState = vi.fn();

		const imported = await importProjectBytes(new Uint8Array([1]), { replaceAllState });

		expect(imported.ok).toBe(true);
		expect(replaceAllState.mock.calls[0][0].panel).toEqual({
			charts: [],
			slots: {},
			layout: 'template-2col',
			blocks: [],
			nextBlockId: 1,
			nextChartId: 0,
		});
		expect(persist.mock.calls[0][0].panel.charts).toEqual([]);
	});

	it('persists canonical dataset config before replacing state (import ordering)', async () => {
		const persist = vi.fn(async () => {});
		configurePersistenceBackend({
			available: () => true,
			hydrate: async () => null,
			importBytes: async () => ({
				data: {
					datasets: [{
						id: 'only',
						name: 'only.csv',
						rows: [{ x: 1 }],
						columns: [{ name: 'x', type: 'number' }],
						selectedColumns: ['x'],
						chartConfig: {
							bar: { enabled: true },
							globalFilter: { rules: [{ column: 'gone', mode: 'categorical', include: ['v:N'] }] },
						},
					}],
					activeDatasetId: 'only',
				},
				panel: null,
			}),
			persist,
			clear: vi.fn(),
		});
		const replaceAllState = vi.fn();

		const imported = await importProjectBytes(new Uint8Array([1]), { replaceAllState });

		expect(imported.ok).toBe(true);
		// importProjectBytes persists BEFORE replaceAllState, so this proves the stored
		// bytes are canonical, not only the in-memory copy: partial bar block is
		// default-filled and the stale filter (column not in the dataset) is trimmed.
		const persistedConfig = persist.mock.calls[0][0].data.datasets[0].chartConfig;
		expect(persistedConfig.bar.enabled).toBe(true);
		expect(persistedConfig.bar.sort).toBeDefined();
		expect(persistedConfig.globalFilter.rules).toEqual([]);
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
		const replaceAllState = vi.fn();

		await hydrateState({ replaceAllState });

		expect(replaceAllState).toHaveBeenCalledTimes(1);
		expect(replaceAllState.mock.calls[0][0].data.datasets[0].id).toBe('legacy');
		expect(localStorage.getItem('chive.migrated')).toBe('1');

		const secondReplace = vi.fn();
		await hydrateState({ replaceAllState: secondReplace });
		expect(secondReplace).toHaveBeenCalledTimes(1);
		expect(secondReplace.mock.calls[0][0].data.datasets[0].id).toBe('legacy');
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
		const replaceAllState = vi.fn();
		await hydrateState({ replaceAllState });
		expect(replaceAllState).not.toHaveBeenCalled();
	});

	describe('dirty classification', () => {
		it('recognizes activeTab-only config patches', () => {
			expect(isActiveTabOnlyPatch({ activeTab: 'panel' })).toBe(true);
			expect(isActiveTabOnlyPatch({ activeTab: 'panel', bar: {} })).toBe(false);
			expect(isProjectDirtyEvent({ type: STATE_EVENTS.CONFIG_UPDATED, data: { activeTab: 'panel' } })).toBe(false);
			expect(isProjectDirtyEvent({ type: STATE_EVENTS.CONFIG_UPDATED, data: { bar: { category: 'x' } } })).toBe(true);
			expect(isProjectDirtyEvent({ type: STATE_EVENTS.ACTIVE_DATASET, data: 0 })).toBe(true);
			expect(isProjectDirtyEvent({ type: STATE_EVENTS.PREVIEW_ROWS_CHANGED, data: 50 })).toBe(false);
		});
	});

	describe('enablePersistenceAutoSave()', () => {
		afterEach(() => {
			vi.useRealTimers();
		});

		it('auto-save targets a backend swapped in AFTER the controller was created (live binding)', async () => {
			vi.useFakeTimers();
			const first = vi.fn(async () => {});
			const second = vi.fn(async () => {});
			configurePersistenceBackend({ available: () => true, hydrate: async () => null, persist: first, clear: vi.fn() });
			activeController = enablePersistenceAutoSave(() => makeSnapshot(), { debounceMs: 2000 });
			configurePersistenceBackend({ available: () => true, hydrate: async () => null, persist: second, clear: vi.fn() });

			emitStateChange(STATE_EVENTS.DATASET_ADDED, { index: 0 });
			await vi.advanceTimersByTimeAsync(2000);

			expect(first).not.toHaveBeenCalled();
			expect(second).toHaveBeenCalledTimes(1);
		});

		it('auto-saves project changes after the debounce and ignores activeTab-only changes', async () => {
			vi.useFakeTimers();
			const persist = vi.fn(async () => {});
			configurePersistenceBackend({
				available: () => true,
				hydrate: async () => null,
				persist,
				clear: vi.fn(),
			});
			activeController = enablePersistenceAutoSave(() => makeSnapshot(), { debounceMs: 2000 });

			emitStateChange(STATE_EVENTS.CONFIG_UPDATED, { activeTab: 'charts' });
			await vi.advanceTimersByTimeAsync(2000);
			expect(persist).not.toHaveBeenCalled();
			expect(activeController.getStatus().dirty).toBe(false);

			emitStateChange(STATE_EVENTS.CONFIG_UPDATED, { bar: { category: 'x' } });
			expect(activeController.getStatus().dirty).toBe(true);
			await vi.advanceTimersByTimeAsync(1999);
			expect(persist).not.toHaveBeenCalled();
			await vi.advanceTimersByTimeAsync(1);
			expect(persist).toHaveBeenCalledTimes(1);
			expect(activeController.getStatus().dirty).toBe(false);
		});

		it('writes UI prefs immediately without scheduling a project save', async () => {
			vi.useFakeTimers();
			const persist = vi.fn(async () => {});
			configurePersistenceBackend({
				available: () => true,
				hydrate: async () => null,
				persist,
				clear: vi.fn(),
			});
			const state = makeSnapshot({ ui: { sidebarMode: 'panel', previewRows: 50 } });
			activeController = enablePersistenceAutoSave(() => state, { debounceMs: 2000 });

			emitStateChange(STATE_EVENTS.SIDEBAR_MODE_CHANGED, 'panel');

			expect(JSON.parse(localStorage.getItem('chive.ui'))).toEqual({ sidebarMode: 'panel', previewRows: 50 });
			expect(activeController.getStatus().dirty).toBe(false);
			await vi.advanceTimersByTimeAsync(2000);
			expect(persist).not.toHaveBeenCalled();
		});

		it('returns a noop controller when getState is not a function', async () => {
			const controller = enablePersistenceAutoSave(null);

			await expect(controller.saveNow()).resolves.toEqual(expect.objectContaining({ ok: false }));
			expect(controller.getStatus()).toEqual({
				dirty: false,
				saving: false,
				lastSavedAt: null,
				lastError: null,
			});
			expect(() => controller.dispose()).not.toThrow();
		});

		it('saveNow skips clean state and dispose removes listeners idempotently', async () => {
			vi.useFakeTimers();
			const persist = vi.fn(async () => {});
			configurePersistenceBackend({
				available: () => true,
				hydrate: async () => null,
				persist,
				clear: vi.fn(),
			});

			activeController = enablePersistenceAutoSave(() => makeSnapshot(), { debounceMs: 2000 });
			expect(await activeController.saveNow()).toEqual({ ok: true, skipped: true });
			activeController.dispose();
			activeController.dispose();

			expect(persist).not.toHaveBeenCalled();
		});

		it('flushes dirty state on pagehide and hidden visibility changes', async () => {
			vi.useFakeTimers();
			const persist = vi.fn(async () => {});
			configurePersistenceBackend({
				available: () => true,
				hydrate: async () => null,
				persist,
				clear: vi.fn(),
			});
			activeController = enablePersistenceAutoSave(() => makeSnapshot(), { debounceMs: 2000 });

			emitStateChange(STATE_EVENTS.DATASET_ADDED, { index: 0 });
			window.dispatchEvent(new Event('pagehide'));
			await Promise.resolve();
			expect(persist).toHaveBeenCalledTimes(1);

			emitStateChange(STATE_EVENTS.CHART_ADDED, { chartId: 1 });
			let restoreVisibilityState = setDocumentVisibilityState('visible');
			try {
				document.dispatchEvent(new Event('visibilitychange'));
				await Promise.resolve();
			} finally {
				restoreVisibilityState();
			}
			expect(persist).toHaveBeenCalledTimes(1);

			restoreVisibilityState = setDocumentVisibilityState('hidden');
			try {
				document.dispatchEvent(new Event('visibilitychange'));
				await Promise.resolve();
			} finally {
				restoreVisibilityState();
			}
			expect(persist).toHaveBeenCalledTimes(2);
		});

		it('flushes dirty state on freeze lifecycle events', async () => {
			vi.useFakeTimers();
			const persist = vi.fn(async () => {});
			configurePersistenceBackend({
				available: () => true,
				hydrate: async () => null,
				persist,
				clear: vi.fn(),
			});
			activeController = enablePersistenceAutoSave(() => makeSnapshot(), { debounceMs: 2000 });

			emitStateChange(STATE_EVENTS.DATASET_ADDED, { index: 0 });
			document.dispatchEvent(new Event('freeze'));
			await Promise.resolve();

			expect(persist).toHaveBeenCalledTimes(1);
		});

		it('coalesces lifecycle flush triggers while a save is in flight', async () => {
			vi.useFakeTimers();
			let resolvePersist;
			const persist = vi.fn(() => new Promise(resolve => {
				resolvePersist = resolve;
			}));
			configurePersistenceBackend({
				available: () => true,
				hydrate: async () => null,
				persist,
				clear: vi.fn(),
			});
			activeController = enablePersistenceAutoSave(() => makeSnapshot(), { debounceMs: 2000 });

			emitStateChange(STATE_EVENTS.DATASET_ADDED, { index: 0 });
			const restoreVisibilityState = setDocumentVisibilityState('hidden');
			try {
				document.dispatchEvent(new Event('visibilitychange'));
				window.dispatchEvent(new Event('pagehide'));
				document.dispatchEvent(new Event('freeze'));
			} finally {
				restoreVisibilityState();
			}

			expect(persist).toHaveBeenCalledTimes(1);

			resolvePersist();
			await flushMicrotasks();
			expect(activeController.getStatus().dirty).toBe(false);
		});

		it('dispose removes the freeze listener before dirty state can flush', async () => {
			vi.useFakeTimers();
			const persist = vi.fn(async () => {});
			configurePersistenceBackend({
				available: () => true,
				hydrate: async () => null,
				persist,
				clear: vi.fn(),
			});
			activeController = enablePersistenceAutoSave(() => makeSnapshot(), { debounceMs: 2000 });

			emitStateChange(STATE_EVENTS.DATASET_ADDED, { index: 0 });
			activeController.dispose();
			document.dispatchEvent(new Event('freeze'));
			await vi.advanceTimersByTimeAsync(2000);

			expect(persist).not.toHaveBeenCalled();
		});

		it('coalesces a burst of edits into a single debounced save', async () => {
			vi.useFakeTimers();
			const persist = vi.fn(async () => {});
			configurePersistenceBackend({
				available: () => true,
				hydrate: async () => null,
				persist,
				clear: vi.fn(),
			});
			activeController = enablePersistenceAutoSave(() => makeSnapshot(), { debounceMs: 2000 });

			emitStateChange(STATE_EVENTS.DATASET_ADDED, { index: 0 });
			await vi.advanceTimersByTimeAsync(1000);
			emitStateChange(STATE_EVENTS.CHART_ADDED, { chartId: 1 });
			await vi.advanceTimersByTimeAsync(1000);
			emitStateChange(STATE_EVENTS.CONFIG_UPDATED, { bar: { category: 'x' } });
			expect(persist).not.toHaveBeenCalled();

			await vi.advanceTimersByTimeAsync(2000);
			expect(persist).toHaveBeenCalledTimes(1);
			expect(activeController.getStatus().dirty).toBe(false);
		});

		it('keeps dirty state and reports quota failures', async () => {
			vi.useFakeTimers();
			const quotaError = new DOMException('full', 'QuotaExceededError');
			const onSaveError = vi.fn();
			configurePersistenceBackend({
				available: () => true,
				hydrate: async () => null,
				persist: vi.fn(async () => { throw quotaError; }),
				clear: vi.fn(),
			});
			activeController = enablePersistenceAutoSave(() => makeSnapshot(), { debounceMs: 2000, onSaveError });

			emitStateChange(STATE_EVENTS.DATASET_ADDED, { index: 0 });
			await vi.advanceTimersByTimeAsync(2000);

			expect(activeController.getStatus().dirty).toBe(true);
			expect(onSaveError.mock.calls[0][0].name).toBe('QuotaExceededError');
			expect(onSaveError.mock.calls[0][1]).toEqual(expect.objectContaining({ ok: false }));
			expect(getPersistenceErrorMessageKey(onSaveError.mock.calls[0][0])).toBe('chive-save-failed-quota');
		});

		it('coalesces an in-flight save and re-kicks after a mid-save edit', async () => {
			const resolvers = [];
			const persist = vi.fn(() => new Promise(resolve => resolvers.push(resolve)));
			configurePersistenceBackend({
				available: () => true,
				hydrate: async () => null,
				persist,
				clear: vi.fn(),
			});
			activeController = enablePersistenceAutoSave(() => makeSnapshot(), { debounceMs: 2000 });

			// Drive saveNow directly to exercise the in-flight coalescing path,
			// independent of the debounce trigger.
			emitStateChange(STATE_EVENTS.DATASET_ADDED, { index: 0 });
			const first = activeController.saveNow();
			emitStateChange(STATE_EVENTS.CHART_ADDED, { chartId: 1 });
			const second = activeController.saveNow();

			expect(second).toBe(first);
			expect(persist).toHaveBeenCalledTimes(1);

			resolvers[0]();
			await first;
			expect(activeController.getStatus().dirty).toBe(true);
			expect(persist).toHaveBeenCalledTimes(2);

			resolvers[1]();
			await Promise.resolve();
			await Promise.resolve();
			expect(activeController.getStatus().dirty).toBe(false);
		});
	});
});
