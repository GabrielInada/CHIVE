// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { createPersistHandler } from '../../src/workers/persistWorker.js';

// The handler's cache / staged-commit / needsResync / chain logic is backend-
// agnostic, so these unit tests drive it with a spy backend (real SQLite is
// covered end-to-end in workerBackend.test.js). A spy lets us assert exactly
// what `full` snapshot the handler reconstructs and simulate persist failures.
function spyBackend(overrides = {}) {
	return {
		persist: vi.fn(() => Promise.resolve()),
		hydrate: vi.fn(() => Promise.resolve(null)),
		exportBytes: vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3]))),
		importBytes: vi.fn(() => Promise.resolve({ data: { datasets: [] }, panel: null })),
		clear: vi.fn(() => Promise.resolve()),
		...overrides,
	};
}

function persistMsg(id, datasets, charts) {
	return {
		id,
		op: 'persist',
		snapshot: {
			data: { datasets, activeIndex: datasets.length ? 0 : -1 },
			panel: charts ? { charts } : null,
		},
	};
}

describe('createPersistHandler', () => {
	it('reconstructs full rows and caches them on a successful persist', async () => {
		const backend = spyBackend();
		const posts = [];
		const h = createPersistHandler(backend, m => posts.push(m));

		const rows = [{ x: 1 }];
		await h.handleMessage(persistMsg(1, [{ id: 'ds-1', name: 'a', rows }]));

		expect(backend.persist).toHaveBeenCalledTimes(1);
		expect(backend.persist.mock.calls[0][0].data.datasets[0].rows).toBe(rows);
		expect(posts).toEqual([{ id: 1, ok: true, result: null }]);
		expect(h.rowsCache.get('ds-1')).toBe(rows);
	});

	it('refills rowsCached datasets from cache and strips the flag', async () => {
		const backend = spyBackend();
		const posts = [];
		const h = createPersistHandler(backend, m => posts.push(m));

		const rows = [{ x: 1 }];
		await h.handleMessage(persistMsg(1, [{ id: 'ds-1', name: 'a', rows }]));
		await h.handleMessage(persistMsg(2, [{ id: 'ds-1', name: 'a', rowsCached: true }]));

		const full = backend.persist.mock.calls[1][0];
		expect(full.data.datasets[0].rows).toBe(rows);
		expect(full.data.datasets[0].rowsCached).toBeUndefined();
	});

	it('refills cached chart snapshots (data + cols) from cache', async () => {
		const backend = spyBackend();
		const h = createPersistHandler(backend, () => {});

		const data = [{ x: 1 }];
		const cols = [{ name: 'x', type: 'number' }];
		await h.handleMessage(persistMsg(1, [], [{ id: 0, dataSnapshot: data, columnsSnapshot: cols }]));
		expect(h.snapshotCache.get(0)).toEqual({ data, cols });

		await h.handleMessage(persistMsg(2, [], [{ id: 0, dataSnapshotCached: true, columnsSnapshotCached: true }]));
		const full = backend.persist.mock.calls[1][0];
		expect(full.panel.charts[0].dataSnapshot).toBe(data);
		expect(full.panel.charts[0].columnsSnapshot).toBe(cols);
		expect(full.panel.charts[0].dataSnapshotCached).toBeUndefined();
		expect(full.panel.charts[0].columnsSnapshotCached).toBeUndefined();
	});

	it('replies needsResync (and does NOT persist) on a cache miss', async () => {
		const backend = spyBackend();
		const posts = [];
		const h = createPersistHandler(backend, m => posts.push(m));

		await h.handleMessage(persistMsg(1, [{ id: 'ghost', rowsCached: true }]));

		expect(posts).toEqual([{ id: 1, ok: false, needsResync: true }]);
		expect(backend.persist).not.toHaveBeenCalled();
	});

	it('stages cache changes: a failed persist leaves the caches unmutated', async () => {
		let shouldFail = false;
		const backend = spyBackend({
			persist: vi.fn(() => (shouldFail ? Promise.reject(new Error('disk full')) : Promise.resolve())),
		});
		const posts = [];
		const h = createPersistHandler(backend, m => posts.push(m));

		const rows1 = [{ x: 1 }];
		await h.handleMessage(persistMsg(1, [{ id: 'ds-1', rows: rows1 }]));
		expect(h.rowsCache.get('ds-1')).toBe(rows1);

		shouldFail = true;
		const rows2 = [{ x: 2 }];
		await h.handleMessage(persistMsg(2, [{ id: 'ds-2', rows: rows2 }]));

		expect(posts[1].ok).toBe(false);
		// The failed op committed nothing: ds-1 stays, ds-2 never landed.
		expect(h.rowsCache.get('ds-1')).toBe(rows1);
		expect(h.rowsCache.has('ds-2')).toBe(false);
	});

	it('recovers the chain after a per-op throw and processes the next message', async () => {
		let calls = 0;
		const backend = spyBackend({
			persist: vi.fn(() => {
				calls += 1;
				return calls === 1
					? Promise.reject(Object.assign(new Error('boom'), { name: 'QuotaExceededError' }))
					: Promise.resolve();
			}),
		});
		const posts = [];
		const h = createPersistHandler(backend, m => posts.push(m));

		await h.handleMessage(persistMsg(1, []));
		await h.handleMessage(persistMsg(2, []));

		expect(posts[0]).toEqual({ id: 1, ok: false, error: { name: 'QuotaExceededError', message: 'boom' } });
		expect(posts[1]).toEqual({ id: 2, ok: true, result: null });
	});

	it('empties both caches on clear', async () => {
		const backend = spyBackend();
		const h = createPersistHandler(backend, () => {});

		await h.handleMessage(persistMsg(1, [{ id: 'ds-1', rows: [{ x: 1 }] }], [{ id: 0, dataSnapshot: [{ x: 1 }], columnsSnapshot: [] }]));
		expect(h.rowsCache.size).toBe(1);
		expect(h.snapshotCache.size).toBe(1);

		await h.handleMessage({ id: 2, op: 'clear' });
		expect(backend.clear).toHaveBeenCalledTimes(1);
		expect(h.rowsCache.size).toBe(0);
		expect(h.snapshotCache.size).toBe(0);
	});

	it('delegates project export and import ops through the serialized chain', async () => {
		const imported = { data: { datasets: [{ id: 'ds-1' }] }, panel: null };
		const backend = spyBackend({
			exportBytes: vi.fn(() => Promise.resolve(new Uint8Array([7, 8]))),
			importBytes: vi.fn(() => Promise.resolve(imported)),
		});
		const posts = [];
		const h = createPersistHandler(backend, m => posts.push(m));
		const snapshot = { data: { datasets: [] }, panel: null };
		const bytes = new Uint8Array([1, 2, 3]);

		await h.handleMessage({ id: 10, op: 'export', snapshot, workOnly: true });
		await h.handleMessage({ id: 11, op: 'import', bytes });

		expect(backend.exportBytes).toHaveBeenCalledWith(snapshot, { workOnly: true });
		expect(backend.importBytes).toHaveBeenCalledWith(bytes);
		expect(posts[0]).toEqual({ id: 10, ok: true, result: new Uint8Array([7, 8]) });
		expect(posts[1]).toEqual({ id: 11, ok: true, result: imported });
	});

	it('serializes ops: a clear waits for an in-flight persist and ordering is preserved', async () => {
		let resolvePersist;
		const backend = spyBackend({
			persist: vi.fn(() => new Promise(resolve => { resolvePersist = resolve; })),
		});
		const posts = [];
		const h = createPersistHandler(backend, m => posts.push(m));

		const p1 = h.handleMessage(persistMsg(1, []));
		const p2 = h.handleMessage({ id: 2, op: 'clear' });

		// clear must not run while persist is in flight.
		await Promise.resolve();
		expect(backend.clear).not.toHaveBeenCalled();

		resolvePersist();
		await p1;
		await p2;

		expect(backend.clear).toHaveBeenCalledTimes(1);
		expect(posts.map(m => m.id)).toEqual([1, 2]);
	});

	it('drops ids that are absent from a later snapshot (cache prune)', async () => {
		const backend = spyBackend();
		const h = createPersistHandler(backend, () => {});

		await h.handleMessage(persistMsg(1, [{ id: 'ds-1', rows: [{ x: 1 }] }, { id: 'ds-2', rows: [{ y: 2 }] }]));
		expect(h.rowsCache.size).toBe(2);

		// ds-2 removed: next successful persist drops it from the worker cache.
		await h.handleMessage(persistMsg(2, [{ id: 'ds-1', rowsCached: true }]));
		expect(h.rowsCache.has('ds-1')).toBe(true);
		expect(h.rowsCache.has('ds-2')).toBe(false);
	});
});
