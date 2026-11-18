// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { createWorkerBackend } from '../../../../src/services/persistence/backends/workerBackend.js';
import { createPersistHandler } from '../../../../src/workers/persistWorker.js';
import { attachRealHandler, MockWorker, nextDb, snap, spyFallback } from './workerBackend.testSupport.js';

function snapshotWithPlacements() {
	const snapshot = snap();
	snapshot.panel.charts[0].sourceDatasetId = 'ds-1';
	snapshot.panel.blocks = [{
		id: 'block-1', templateId: 'template-2col', slots: { 'slot-1': 0, 'slot-2': 0 },
		placements: {
			'slot-1': { followGlobalFilter: true, dataSnapshot: [], columnsSnapshot: [{ name: 'x', type: 'number' }] },
			'slot-2': { followGlobalFilter: false, dataSnapshot: [{ x: 2 }], columnsSnapshot: [{ name: 'x', type: 'number' }] },
		},
	}];
	return snapshot;
}
const slots = snapshot => snapshot.panel.blocks[0].placements;

describe('placement persistence through the worker', () => {
	it('round-trips independent captures, deduplicates arrays, and exports/imports full projects', async () => {
		const worker = new MockWorker();
		attachRealHandler(worker, nextDb());
		const backend = createWorkerBackend({ workerFactory: () => worker });
		const snapshot = snapshotWithPlacements();
		await backend.persist(snapshot);
		await backend.persist(snapshot);
		const cached = slots(worker.posted[1].snapshot)['slot-1'];
		expect(cached).toEqual({ followGlobalFilter: true, dataSnapshotCached: true, columnsSnapshotCached: true });
		const restored = await backend.hydrate();
		expect(slots(restored)).toEqual(slots(snapshot));
		expect(restored.panel.charts[0].sourceDatasetId).toBe('ds-1');
		const imported = await backend.importBytes(await backend.exportBytes(snapshot));
		expect(slots(imported)).toEqual(slots(snapshot));
		const workOnly = await backend.importBytes(await backend.exportBytes(snapshot, { omitDataPayloads: true }));
		expect(workOnly.data.datasets[0].rows).toBeNull();
		expect(slots(workOnly)['slot-2'].dataSnapshot).toBeUndefined();
	});

	it('sends changed captures after a move and prunes removed placement cache entries', async () => {
		const worker = new MockWorker();
		attachRealHandler(worker, nextDb());
		const backend = createWorkerBackend({ workerFactory: () => worker });
		const snapshot = snapshotWithPlacements();
		await backend.persist(snapshot);
		const before = slots(snapshot)['slot-1'];
		slots(snapshot)['slot-1'] = slots(snapshot)['slot-2'];
		slots(snapshot)['slot-2'] = before;
		await backend.persist(snapshot);
		expect(slots(worker.posted[1].snapshot)['slot-1'].dataSnapshot).toEqual([{ x: 2 }]);
		expect(slots(await backend.hydrate())).toEqual(slots(snapshot));
		delete slots(snapshot)['slot-2'];
		await backend.persist(snapshot);
		slots(snapshot)['slot-2'] = before;
		await backend.persist(snapshot);
		expect(slots(worker.posted.at(-1).snapshot)['slot-2'].dataSnapshotCached).toBeUndefined();
	});

	it('reconstructs queued captures from the call-time record after a worker failure', async () => {
		const worker = new MockWorker();
		const fallback = spyFallback(nextDb());
		const backend = createWorkerBackend({ workerFactory: () => worker, fallbackBackendFactory: () => fallback });
		const snapshot = snapshotWithPlacements();
		const expected = structuredClone(snapshot);
		const saving = backend.persist(snapshot);
		slots(snapshot)['slot-2'] = { followGlobalFilter: true, dataSnapshot: [{ x: 999 }], columnsSnapshot: [] };
		snapshot.panel.blocks = [];
		worker.emitError({ preventDefault() {} });
		await saving;
		expect(slots(fallback.persist.mock.calls[0][0])).toEqual(slots(expected));
	});

	it('stages placement caches only on success, requests missing captures, and clears them', async () => {
		const backend = { persist: vi.fn(), clear: vi.fn() };
		const post = vi.fn();
		const handler = createPersistHandler(backend, post);
		const snapshot = snapshotWithPlacements();
		await handler.handleMessage({ id: 1, op: 'persist', snapshot });
		expect(handler.placementCache.size).toBe(2);
		const cached = structuredClone(snapshot);
		for (const placement of Object.values(slots(cached))) {
			delete placement.dataSnapshot;
			delete placement.columnsSnapshot;
			placement.dataSnapshotCached = true;
			placement.columnsSnapshotCached = true;
		}
		backend.persist.mockRejectedValueOnce(new Error('quota'));
		await handler.handleMessage({ id: 2, op: 'persist', snapshot: { ...snapshot, panel: { ...snapshot.panel, blocks: [] } } });
		expect(handler.placementCache.size).toBe(2);
		await handler.handleMessage({ id: 3, op: 'persist', snapshot: cached });
		expect(slots(backend.persist.mock.calls.at(-1)[0])).toEqual(slots(snapshot));
		await handler.handleMessage({ id: 4, op: 'clear' });
		expect(handler.placementCache.size).toBe(0);
		await handler.handleMessage({ id: 5, op: 'persist', snapshot: cached });
		expect(post).toHaveBeenLastCalledWith({ id: 5, ok: false, needsResync: true });
	});
});
