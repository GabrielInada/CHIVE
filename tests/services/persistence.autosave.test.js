// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clearPersistedState,
	configurePersistenceBackend,
	enablePersistenceAutoSave,
	getPersistenceErrorMessageKey,
	isProjectDirtyEvent,
} from '../../src/services/persistence.js';
import { emitStateChange, STATE_EVENTS } from '../../src/state/stateEvents.js';
import {
	flushMicrotasks,
	makeBackend,
	makeSnapshot,
	setDocumentVisibilityState,
} from './persistence.testSupport.js';

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

	describe('dirty classification', () => {
		it('treats the active dataset tab as durable project configuration', () => {
			expect(isProjectDirtyEvent({ type: STATE_EVENTS.CONFIG_UPDATED, data: { activeTab: 'panel' } })).toBe(true);
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

		it('auto-saves chart changes and active-tab changes after the debounce', async () => {
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
			expect(persist).toHaveBeenCalledTimes(1);
			expect(activeController.getStatus().dirty).toBe(false);

			emitStateChange(STATE_EVENTS.CONFIG_UPDATED, { bar: { category: 'x' } });
			expect(activeController.getStatus().dirty).toBe(true);
			await vi.advanceTimersByTimeAsync(1999);
			expect(persist).toHaveBeenCalledTimes(1);
			await vi.advanceTimersByTimeAsync(1);
			expect(persist).toHaveBeenCalledTimes(2);
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
