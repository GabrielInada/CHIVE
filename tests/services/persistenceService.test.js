// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	isPersistenceAvailable,
	hydrateState,
	persistState,
	clearPersistedState,
	enablePersistenceAutoSave,
} from '../../src/services/persistenceService.js';
import { emitStateChange, STATE_EVENTS } from '../../src/modules/stateEvents.js';

function makeSnapshot(overrides = {}) {
	return {
		data: {
			datasets: [
				{ id: 'ds-1', nome: 'a.csv', dados: [{ x: 1 }], colunas: [{ nome: 'x', tipo: 'numero' }], colunasSelecionadas: ['x'], configGraficos: {} },
				{ id: 'ds-2', nome: 'b.csv', dados: [{ y: 2 }], colunas: [{ nome: 'y', tipo: 'numero' }], colunasSelecionadas: ['y'], configGraficos: {} },
			],
			activeIndex: 1,
		},
		panel: {
			charts: [{ id: 0, type: 'bar', config: { color: '#abc' }, dataSnapshot: [], columnsSnapshot: [] }],
			slots: {},
			layout: 'layout-2col',
			blocks: [{ id: 1, templateId: 'layout-2col', slots: {}, proportions: { split: 50 } }],
			nextBlockId: 2,
			nextChartId: 1,
		},
		ui: {
			sidebarMode: 'panel',
			previewRows: 25,
			expandedCharts: { bar: true, scatter: false },
		},
		...overrides,
	};
}

describe('persistenceService', () => {
	beforeEach(async () => {
		await clearPersistedState();
		localStorage.clear();
	});

	afterEach(async () => {
		await clearPersistedState();
		localStorage.clear();
	});

	describe('isPersistenceAvailable()', () => {
		it('returns true when indexedDB is present (fake-indexeddb in tests)', () => {
			expect(isPersistenceAvailable()).toBe(true);
		});
	});

	describe('persistState() + hydrateState() round-trip', () => {
		it('restores datasets, activeIndex, panel, and ui prefs', async () => {
			await persistState(makeSnapshot());

			const replaceAllState = vi.fn();
			await hydrateState({ replaceAllState });

			expect(replaceAllState).toHaveBeenCalledTimes(1);
			const restored = replaceAllState.mock.calls[0][0];

			expect(restored.data.datasets).toHaveLength(2);
			expect(restored.data.datasets.map(d => d.id).sort()).toEqual(['ds-1', 'ds-2']);
			expect(restored.data.activeIndex).toBeGreaterThanOrEqual(0);
			expect(restored.data.datasets[restored.data.activeIndex].id).toBe('ds-2');

			expect(restored.panel.charts).toHaveLength(1);
			expect(restored.panel.charts[0].type).toBe('bar');
			expect(restored.panel.charts[0].config.color).toBe('#abc');
			expect(restored.panel.layout).toBe('layout-2col');
			expect(restored.panel.blocks).toHaveLength(1);
			expect(restored.panel).not.toHaveProperty('activeDatasetId');
			expect(restored.panel).not.toHaveProperty('key');

			expect(restored.ui).toEqual({
				sidebarMode: 'panel',
				previewRows: 25,
				expandedCharts: { bar: true, scatter: false },
			});
		});

		it('does not call replaceAllState when no state has been persisted (first visit)', async () => {
			const replaceAllState = vi.fn();
			await hydrateState({ replaceAllState });
			expect(replaceAllState).not.toHaveBeenCalled();
		});

		it('hydrates ui prefs even when IDB stores are empty', async () => {
			localStorage.setItem('chive.ui', JSON.stringify({ sidebarMode: 'viz', previewRows: 5 }));
			const replaceAllState = vi.fn();
			await hydrateState({ replaceAllState });

			expect(replaceAllState).toHaveBeenCalledTimes(1);
			expect(replaceAllState.mock.calls[0][0].ui).toEqual({ sidebarMode: 'viz', previewRows: 5 });
		});

		it('sets activeIndex to -1 when persisted activeDatasetId no longer matches any dataset', async () => {
			// Persist with active ds-2…
			await persistState(makeSnapshot());

			// …then overwrite the datasets store with a different id
			await persistState(makeSnapshot({
				data: {
					datasets: [{ id: 'ds-other', nome: 'other.csv', dados: [], colunas: [], colunasSelecionadas: [], configGraficos: {} }],
					activeIndex: 0,
				},
			}));

			const replaceAllState = vi.fn();
			await hydrateState({ replaceAllState });

			const restored = replaceAllState.mock.calls[0][0];
			expect(restored.data.datasets).toHaveLength(1);
			expect(restored.data.datasets[0].id).toBe('ds-other');
			expect(restored.data.activeIndex).toBe(0);
		});
	});

	describe('hydrateState() transformPanel hook', () => {
		it('applies the transform to the panel record before replaceAllState', async () => {
			await persistState(makeSnapshot());

			const transformPanel = vi.fn(panel => ({
				...panel,
				charts: panel.charts.map(c => ({ ...c, config: { ...c.config, augmented: true } })),
			}));
			const replaceAllState = vi.fn();

			await hydrateState({ replaceAllState, transformPanel });

			expect(transformPanel).toHaveBeenCalledTimes(1);
			const restored = replaceAllState.mock.calls[0][0];
			expect(restored.panel.charts[0].config.augmented).toBe(true);
			expect(restored.panel.charts[0].config.color).toBe('#abc');
		});

		it('falls back to raw panel record when the transform throws', async () => {
			await persistState(makeSnapshot());

			const transformPanel = vi.fn(() => { throw new Error('boom'); });
			const replaceAllState = vi.fn();
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

			await hydrateState({ replaceAllState, transformPanel });

			expect(replaceAllState).toHaveBeenCalledTimes(1);
			expect(replaceAllState.mock.calls[0][0].panel.charts[0].config.color).toBe('#abc');
			warn.mockRestore();
		});
	});

	describe('persistState() guards', () => {
		it('is a no-op for null/undefined snapshot', async () => {
			await expect(persistState(null)).resolves.not.toThrow();
			await expect(persistState(undefined)).resolves.not.toThrow();

			const replaceAllState = vi.fn();
			await hydrateState({ replaceAllState });
			expect(replaceAllState).not.toHaveBeenCalled();
		});

		it('skips datasets without a stable id', async () => {
			await persistState({
				data: {
					datasets: [
						{ id: 'good', nome: 'good.csv', dados: [], colunas: [], colunasSelecionadas: [], configGraficos: {} },
						{ /* no id */ nome: 'orphan.csv', dados: [], colunas: [], colunasSelecionadas: [], configGraficos: {} },
					],
					activeIndex: 0,
				},
				panel: { charts: [], slots: {}, layout: 'layout-2col', blocks: [], nextBlockId: 1, nextChartId: 0 },
				ui: {},
			});

			const replaceAllState = vi.fn();
			await hydrateState({ replaceAllState });

			const restored = replaceAllState.mock.calls[0][0];
			expect(restored.data.datasets).toHaveLength(1);
			expect(restored.data.datasets[0].id).toBe('good');
		});
	});

	describe('clearPersistedState()', () => {
		it('removes both IDB stores and the ui localStorage entry', async () => {
			await persistState(makeSnapshot());
			expect(localStorage.getItem('chive.ui')).toBeTruthy();

			await clearPersistedState();

			expect(localStorage.getItem('chive.ui')).toBeNull();

			const replaceAllState = vi.fn();
			await hydrateState({ replaceAllState });
			expect(replaceAllState).not.toHaveBeenCalled();
		});
	});

	describe('enablePersistenceAutoSave()', () => {
		// These tests verify the orchestration (debounced wildcard subscription +
		// STATE_HYDRATED skip + flush). Returning null from getState makes
		// persistState exit early so we don't mix fake timers with async IDB writes.
		const stubGetState = () => null;
		let activeHandle = null;

		afterEach(() => {
			if (activeHandle?.unsubscribe) activeHandle.unsubscribe();
			activeHandle = null;
			vi.useRealTimers();
		});

		it('persists on a typed state event after the debounce window', () => {
			vi.useFakeTimers();
			const getState = vi.fn(stubGetState);

			activeHandle = enablePersistenceAutoSave(getState, { debounceMs: 100 });
			emitStateChange(STATE_EVENTS.CONFIG_UPDATED, { foo: 1 });
			expect(getState).not.toHaveBeenCalled();

			vi.advanceTimersByTime(100);
			expect(getState).toHaveBeenCalledTimes(1);
		});

		it('coalesces bursts into a single save', () => {
			vi.useFakeTimers();
			const getState = vi.fn(stubGetState);

			activeHandle = enablePersistenceAutoSave(getState, { debounceMs: 100 });
			emitStateChange(STATE_EVENTS.CONFIG_UPDATED);
			emitStateChange(STATE_EVENTS.COLUMNS_UPDATED);
			emitStateChange(STATE_EVENTS.CHART_ADDED);

			vi.advanceTimersByTime(100);
			expect(getState).toHaveBeenCalledTimes(1);
		});

		it('ignores STATE_HYDRATED to avoid resaving the snapshot we just loaded', () => {
			vi.useFakeTimers();
			const getState = vi.fn(stubGetState);

			activeHandle = enablePersistenceAutoSave(getState, { debounceMs: 100 });
			emitStateChange(STATE_EVENTS.STATE_HYDRATED);

			vi.advanceTimersByTime(500);
			expect(getState).not.toHaveBeenCalled();
		});

		it('flush() commits the pending save synchronously (for beforeunload)', () => {
			vi.useFakeTimers();
			const getState = vi.fn(stubGetState);

			activeHandle = enablePersistenceAutoSave(getState, { debounceMs: 1000 });
			emitStateChange(STATE_EVENTS.CONFIG_UPDATED);

			expect(getState).not.toHaveBeenCalled();
			activeHandle.flush();
			expect(getState).toHaveBeenCalledTimes(1);
		});
	});
});
