// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clearPersistedState,
	enablePersistenceAutoSave,
	hydrateState,
	persistState,
} from '../../src/services/persistenceService.js';
import { emitStateChange, STATE_EVENTS } from '../../src/modules/stateEvents.js';

function makeDataset(id, payload = {}) {
	return {
		id,
		nome: `${id}.csv`,
		dados: [{ x: 1 }],
		colunas: [{ nome: 'x', tipo: 'numero' }],
		colunasSelecionadas: ['x'],
		configGraficos: {},
		...payload,
	};
}

function makeSnapshot(datasets, panel = {}) {
	return {
		data: { datasets, activeIndex: datasets.length > 0 ? 0 : -1 },
		panel: {
			charts: [],
			slots: {},
			layout: 'layout-2col',
			blocks: [{ id: 1, templateId: 'layout-2col', slots: {}, proportions: { split: 50 } }],
			nextBlockId: 2,
			nextChartId: 0,
			...panel,
		},
		ui: { sidebarMode: 'dados', previewRows: 10, expandedCharts: {} },
	};
}

describe('persistenceService — dirty/removed diff', () => {
	beforeEach(async () => {
		await clearPersistedState();
		localStorage.clear();
	});

	afterEach(async () => {
		await clearPersistedState();
		localStorage.clear();
	});

	describe('persistState(snapshot, diff)', () => {
		it('only writes datasets in diff.dirty; leaves untouched records on disk', async () => {
			// Seed both records via the legacy "clear + put all" path.
			await persistState(makeSnapshot([
				makeDataset('ds-1', { configGraficos: { bar: { color: '#aaa' } } }),
				makeDataset('ds-2', { configGraficos: { bar: { color: '#bbb' } } }),
			]));

			// Now claim ds-1 was changed in memory (color flipped), but only mark
			// ds-2 dirty. The IDB record for ds-1 must still hold the OLD color.
			await persistState(
				makeSnapshot([
					makeDataset('ds-1', { configGraficos: { bar: { color: '#999' /* IGNORED */ } } }),
					makeDataset('ds-2', { configGraficos: { bar: { color: '#ccc' /* WRITTEN */ } } }),
				]),
				{ dirty: ['ds-2'], removed: [] },
			);

			const replaceAllState = vi.fn();
			await hydrateState({ replaceAllState });
			const restored = replaceAllState.mock.calls[0][0];

			const ds1 = restored.data.datasets.find(d => d.id === 'ds-1');
			const ds2 = restored.data.datasets.find(d => d.id === 'ds-2');

			expect(ds1.configGraficos.bar.color).toBe('#aaa');  // untouched on disk
			expect(ds2.configGraficos.bar.color).toBe('#ccc');  // freshly written
		});

		it('deletes ids listed in diff.removed and leaves other records alone', async () => {
			await persistState(makeSnapshot([
				makeDataset('ds-1'),
				makeDataset('ds-2'),
			]));

			// Snapshot now has only ds-2; mark ds-1 removed.
			await persistState(
				makeSnapshot([makeDataset('ds-2')]),
				{ dirty: [], removed: ['ds-1'] },
			);

			const replaceAllState = vi.fn();
			await hydrateState({ replaceAllState });
			const restored = replaceAllState.mock.calls[0][0];

			expect(restored.data.datasets.map(d => d.id).sort()).toEqual(['ds-2']);
		});

		it('handles a save where dirty and removed are both non-empty', async () => {
			await persistState(makeSnapshot([
				makeDataset('keep', { configGraficos: { bar: { color: '#000' } } }),
				makeDataset('drop'),
			]));

			await persistState(
				makeSnapshot([
					makeDataset('keep', { configGraficos: { bar: { color: '#fff' } } }),
					makeDataset('new'),
				]),
				{ dirty: ['keep', 'new'], removed: ['drop'] },
			);

			const replaceAllState = vi.fn();
			await hydrateState({ replaceAllState });
			const restored = replaceAllState.mock.calls[0][0];

			const ids = restored.data.datasets.map(d => d.id).sort();
			expect(ids).toEqual(['keep', 'new']);
			const keep = restored.data.datasets.find(d => d.id === 'keep');
			expect(keep.configGraficos.bar.color).toBe('#fff');
		});

		it('null diff falls back to legacy "clear + put all" behavior', async () => {
			// Seed [ds-1, ds-2].
			await persistState(makeSnapshot([
				makeDataset('ds-1'),
				makeDataset('ds-2'),
			]));

			// Now save a snapshot with only ds-3, no diff. Legacy path clears + puts.
			await persistState(makeSnapshot([makeDataset('ds-3')]));

			const replaceAllState = vi.fn();
			await hydrateState({ replaceAllState });
			const restored = replaceAllState.mock.calls[0][0];
			expect(restored.data.datasets.map(d => d.id).sort()).toEqual(['ds-3']);
		});

		it('ignores ids in dirty that are not present in the snapshot', async () => {
			// Defensive: a stale dirty mark (e.g. for an id that was added then
			// removed within the same debounce window where the cancellation
			// somehow missed) shouldn't crash.
			await persistState(
				makeSnapshot([makeDataset('present')]),
				{ dirty: ['present', 'ghost'], removed: [] },
			);

			const replaceAllState = vi.fn();
			await hydrateState({ replaceAllState });
			expect(replaceAllState.mock.calls[0][0].data.datasets.map(d => d.id)).toEqual(['present']);
		});
	});

	describe('enablePersistenceAutoSave with diff helpers', () => {
		const stubGetState = () => null; // makes persistState a no-op so we can use fake timers
		let activeHandle = null;

		afterEach(() => {
			if (activeHandle?.unsubscribe) activeHandle.unsubscribe();
			activeHandle = null;
			vi.useRealTimers();
		});

		it('reads getDiff once per save fire and calls clearDiff after the save resolves', async () => {
			vi.useFakeTimers();
			const getDiff = vi.fn(() => ({ dirty: ['x'], removed: [] }));
			const clearDiff = vi.fn();

			activeHandle = enablePersistenceAutoSave(stubGetState, { debounceMs: 100, getDiff, clearDiff });
			emitStateChange(STATE_EVENTS.CONFIG_UPDATED);

			expect(getDiff).not.toHaveBeenCalled();
			expect(clearDiff).not.toHaveBeenCalled();

			vi.advanceTimersByTime(100);
			// Allow the async save() body to settle.
			await vi.runAllTimersAsync();

			expect(getDiff).toHaveBeenCalledTimes(1);
			expect(clearDiff).toHaveBeenCalledTimes(1);
		});

		it('clearDiff also runs on STATE_HYDRATED so marks set during hydration are discarded', () => {
			vi.useFakeTimers();
			const getDiff = vi.fn();
			const clearDiff = vi.fn();

			activeHandle = enablePersistenceAutoSave(stubGetState, { debounceMs: 100, getDiff, clearDiff });
			emitStateChange(STATE_EVENTS.STATE_HYDRATED);

			vi.advanceTimersByTime(500);
			// No save fired (STATE_HYDRATED is skipped) but clearDiff still ran.
			expect(getDiff).not.toHaveBeenCalled();
			expect(clearDiff).toHaveBeenCalledTimes(1);
		});

		it('works without getDiff/clearDiff (legacy callers — back-compat)', async () => {
			vi.useFakeTimers();
			const getState = vi.fn(stubGetState);

			activeHandle = enablePersistenceAutoSave(getState, { debounceMs: 100 });
			emitStateChange(STATE_EVENTS.CONFIG_UPDATED);

			vi.advanceTimersByTime(100);
			await vi.runAllTimersAsync();

			expect(getState).toHaveBeenCalledTimes(1);
		});
	});
});
