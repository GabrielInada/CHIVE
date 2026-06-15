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
} from '../../src/services/persistenceService.js';
import { createBlobBackend } from '../../src/services/persistence/blobBackend.js';
import { emitStateChange, STATE_EVENTS } from '../../src/modules/state/stateEvents.js';

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

describe('persistenceService', () => {
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

	it('reports availability from the active backend', () => {
		expect(isPersistenceAvailable()).toBe(true);
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
		expect(replaceAllState.mock.calls[0][0].data.datasets).toEqual([goodRecord('keep')]);
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

	it('clearPersistedState removes project/UI state, sets the legacy tombstone, and keeps locale', async () => {
		localStorage.setItem('chive.ui', JSON.stringify({ sidebarMode: 'panel', previewRows: 20 }));
		localStorage.setItem('chive-locale', 'en');
		await persistState(makeSnapshot());

		await clearPersistedState();

		expect(localStorage.getItem('chive.ui')).toBeNull();
		expect(localStorage.getItem('chive-locale')).toBe('en');
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
