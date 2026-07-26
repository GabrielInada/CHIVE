// @vitest-environment jsdom

/**
 * End-to-end coverage for stored-data clearing.
 *
 * The unit tests around this workflow mock each other at every seam, which is
 * precisely why two ordering defects survived them: a mocked autosave cannot
 * start the follow-up write that a real one does. Only i18n and the confirmation
 * dialog are stubbed here. The state facade, the autosave controller, the
 * persistence lifecycle, and the SQLite blob backend over IndexedDB are real.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	openConfirmDialog: vi.fn(),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: key => key,
}));

vi.mock('../../../src/ui/confirmDialog.js', () => ({
	openConfirmDialog: mocks.openConfirmDialog,
}));

import { clearStoredProjectData } from '../../../src/app/bindings/clearStoredData.js';
import { __resetProjectOperationLockForTesting } from '../../../src/app/bindings/projectOperationLock.js';
import {
	configurePersistenceBackend,
	enablePersistenceAutoSave,
} from '../../../src/services/persistence.js';
import { getPersistenceSnapshot, replaceAllState } from '../../../src/state/appState.js';
import { emitStateChange, STATE_EVENTS } from '../../../src/state/stateEvents.js';
import { makeBackend } from '../../services/persistence.testSupport.js';

const DEBOUNCE_MS = 5;

function dataset(id, value) {
	return {
		id,
		name: `${id}.csv`,
		rows: [{ x: value }],
		columns: [{ name: 'x', type: 'number' }],
		selectedColumns: ['x'],
		chartConfig: {},
	};
}

function seedProject(datasets) {
	replaceAllState({ data: { datasets, activeIndex: 0 }, panel: {} });
}

/** Real timers throughout: fake-indexeddb and SQLite need their own scheduling. */
function wait(ms) {
	return new Promise(resolve => { setTimeout(resolve, ms); });
}

describe('stored-data clearing, real autosave and real backend', () => {
	let backend;
	let dbName;
	let controller;
	let warnSpy;

	beforeEach(() => {
		__resetProjectOperationLockForTesting();
		mocks.openConfirmDialog.mockResolvedValue(true);
		warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		dbName = `chive-clear-integration-${Math.random().toString(36).slice(2)}`;
		backend = makeBackend({ dbName });
		configurePersistenceBackend(backend);
		controller = enablePersistenceAutoSave(getPersistenceSnapshot, { debounceMs: DEBOUNCE_MS });
	});

	afterEach(async () => {
		controller.dispose();
		configurePersistenceBackend(null);
		replaceAllState({ data: { datasets: [], activeIndex: -1 }, panel: {} });
		localStorage.clear();
		__resetProjectOperationLockForTesting();
		warnSpy.mockRestore();
	});

	const runClear = () => clearStoredProjectData({
		withSavesSuspended: operation => controller.runWithSavesSuspended(operation),
	});

	it('empties the state and the stored database', async () => {
		seedProject([dataset('ds-1', 1)]);
		emitStateChange(STATE_EVENTS.DATASET_ADDED, { index: 0 });
		await controller.saveNow();
		expect(await backend.hydrate()).not.toBeNull();

		await expect(runClear()).resolves.toEqual({ ok: true });

		expect(await backend.hydrate()).toBeNull();
		expect(getPersistenceSnapshot().data.datasets).toEqual([]);
	});

	it('does not let an in-flight save land after the deletion', async () => {
		seedProject([dataset('ds-1', 1)]);
		emitStateChange(STATE_EVENTS.DATASET_ADDED, { index: 0 });

		// A save is on its way to storage when the user confirms the wipe. This is
		// the write that used to arrive after the delete and restore the project.
		const inFlight = controller.saveNow();
		await expect(runClear()).resolves.toEqual({ ok: true });
		await inFlight;

		expect(await backend.hydrate()).toBeNull();
	});

	it('keeps work created during the wipe and saves it afterwards', async () => {
		seedProject([dataset('ds-1', 1)]);
		emitStateChange(STATE_EVENTS.DATASET_ADDED, { index: 0 });
		await controller.saveNow();

		// The settings dialog stays closable, so the user can return to the
		// workspace and start over while the deletion is still running. Waiting
		// past the debounce here is what makes this the losing case: unsuspended,
		// the new work is written, marked clean, and then destroyed by the delete
		// that follows, with nothing left to trigger another save.
		configurePersistenceBackend({
			...backend,
			clear: async () => {
				seedProject([dataset('ds-2', 2)]);
				emitStateChange(STATE_EVENTS.DATASET_ADDED, { index: 0 });
				await wait(DEBOUNCE_MS * 10);
				return backend.clear();
			},
		});

		await expect(runClear()).resolves.toEqual({ ok: true });

		// The wipe still happened, and the newer work was rescheduled rather than
		// dropped with the controller left clean, which is what made the edit
		// unrecoverable before saves were suspended.
		expect(controller.getStatus().dirty).toBe(true);
		await wait(DEBOUNCE_MS * 20);

		const restored = await backend.hydrate();
		expect(restored?.data?.datasets?.map(entry => entry.id)).toEqual(['ds-2']);
	});

	it('refuses to run while a project import or export holds the lock', async () => {
		const { acquireProjectOperation } = await import('../../../src/app/bindings/projectOperationLock.js');
		seedProject([dataset('ds-1', 1)]);
		emitStateChange(STATE_EVENTS.DATASET_ADDED, { index: 0 });
		await controller.saveNow();

		const release = acquireProjectOperation('import');
		await expect(runClear()).resolves.toEqual({ ok: false, busy: true });
		release();

		// Nothing was deleted, and the state the other operation owns is intact.
		expect(await backend.hydrate()).not.toBeNull();
		expect(getPersistenceSnapshot().data.datasets).toHaveLength(1);
	});

	it('reports a blocked deletion rather than claiming the data was removed', async () => {
		seedProject([dataset('ds-1', 1)]);
		emitStateChange(STATE_EVENTS.DATASET_ADDED, { index: 0 });
		await controller.saveNow();

		// Stand in for a second CHIVE tab: an open connection makes the browser
		// refuse to delete the database.
		const blocker = await new Promise((resolve, reject) => {
			const req = indexedDB.open(dbName);
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});

		try {
			await expect(runClear()).resolves.toEqual({ ok: false, reason: 'blocked' });

			// The claim matches reality: the stored project is still there. It has
			// to be read through the connection that is already open, because a
			// blocked delete request stays pending and any new connection queues
			// behind it until the blocker closes.
			const stored = await new Promise((resolve, reject) => {
				const req = blocker.transaction('db', 'readonly').objectStore('db').get('project');
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => reject(req.error);
			});
			expect(stored).toBeTruthy();
		} finally {
			blocker.close();
		}
	});
});
