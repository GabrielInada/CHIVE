// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	__setPersistWorkerFactoryForTesting,
	createWorkerBackend,
} from '../../../../src/services/persistence/backends/workerBackend.js';
import {
	attachRealHandler,
	MockWorker,
	nextDb,
	snap,
	spyFallback,
} from './workerBackend.testSupport.js';

beforeEach(() => {
	// onWorkerError logs a diagnostic on every worker `onerror`; mock it so the
	// crash tests stay quiet.
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	__setPersistWorkerFactoryForTesting(null);
	vi.restoreAllMocks();
});

describe('workerBackend, Stage 2 payload cache', () => {
	function freshDelegating(timeoutMs = 5000) {
		const db = nextDb();
		const workers = [];
		const backend = createWorkerBackend({
			workerFactory: () => { const w = new MockWorker(); attachRealHandler(w, db); workers.push(w); return w; },
			fallbackBackendFactory: () => spyFallback(`${db}-fb`),
			timeoutMs,
		});
		return { backend, workers };
	}

	it('sends full payloads first, then dedups unchanged rows + both snapshot arrays', async () => {
		const { backend, workers } = freshDelegating();
		const rows = [{ x: 1 }];
		const data = [{ x: 1 }];
		const cols = [{ name: 'x', type: 'number' }];

		await backend.persist(snap({ rows, dataSnapshot: data, columnsSnapshot: cols, activeIndex: 0 }));
		await backend.persist(snap({ rows, dataSnapshot: data, columnsSnapshot: cols, activeIndex: 0 }));

		const first = workers[0].posted[0].snapshot;
		expect(Array.isArray(first.data.datasets[0].rows)).toBe(true);
		expect(first.data.datasets[0].rowsCached).toBeUndefined();

		const second = workers[0].posted[1].snapshot;
		expect(second.data.datasets[0].rowsCached).toBe(true);
		expect(second.data.datasets[0].rows).toBeUndefined();
		expect(second.panel.charts[0].dataSnapshotCached).toBe(true);
		expect(second.panel.charts[0].columnsSnapshotCached).toBe(true);
		expect(second.panel.charts[0].dataSnapshot).toBeUndefined();
		expect(second.panel.charts[0].columnsSnapshot).toBeUndefined();
	});

	it('a metadata-only cached message carries no payload arrays at all (no reintroduced clone)', async () => {
		const { backend, workers } = freshDelegating();
		const rows = [{ x: 1 }];
		const data = [{ x: 1 }];
		const cols = [{ name: 'x', type: 'number' }];
		await backend.persist(snap({ rows, dataSnapshot: data, columnsSnapshot: cols }));
		await backend.persist(snap({ rows, dataSnapshot: data, columnsSnapshot: cols }));

		const ds = workers[0].posted[1].snapshot.data.datasets[0];
		const chart = workers[0].posted[1].snapshot.panel.charts[0];
		expect('rows' in ds).toBe(false);
		expect('dataSnapshot' in chart).toBe(false);
		expect('columnsSnapshot' in chart).toBe(false);
	});

	it('sends rows:[] for an empty dataset (authoritative, not flagged cached)', async () => {
		const { backend, workers } = freshDelegating();
		await backend.persist(snap({ rows: [], withChart: false }));
		const ds = workers[0].posted[0].snapshot.data.datasets[0];
		expect(ds.rows).toEqual([]);
		expect(ds.rowsCached).toBeUndefined();
	});

	it('resends full payloads after a worker reset', async () => {
		const db = nextDb();
		const fallback = spyFallback(`${db}-fb`);
		const workers = [];
		let respond = true;
		const backend = createWorkerBackend({
			workerFactory: () => { const w = new MockWorker(); attachRealHandler(w, db, () => respond); workers.push(w); return w; },
			fallbackBackendFactory: () => fallback,
			timeoutMs: 40,
		});

		const rows = [{ x: 1 }];
		await backend.persist(snap({ rows }));              // worker[0], proven, caches
		respond = false;
		await backend.persist(snap({ rows }));              // hangs → reset, sentPayloads cleared
		respond = true;
		await backend.persist(snap({ rows }));              // worker[1], empty cache → full payloads

		const fresh = workers[workers.length - 1].posted[0].snapshot;
		expect(fresh.data.datasets[0].rowsCached).toBeUndefined();
		expect(Array.isArray(fresh.data.datasets[0].rows)).toBe(true);
	});

	it('empties the host cache on clear so the next save sends full payloads', async () => {
		const { backend, workers } = freshDelegating();
		const rows = [{ x: 1 }];
		await backend.persist(snap({ rows }));
		await backend.clear();
		await backend.persist(snap({ rows }));

		const afterClear = workers[0].posted[workers[0].posted.length - 1].snapshot;
		expect(afterClear.data.datasets[0].rowsCached).toBeUndefined();
		expect(Array.isArray(afterClear.data.datasets[0].rows)).toBe(true);
	});

	it('prunes removed dataset and chart payload keys from the host cache', async () => {
		const { backend, workers } = freshDelegating();
		const rows = [{ x: 1 }];
		const data = [{ x: 1 }];
		const cols = [{ name: 'x', type: 'number' }];

		await backend.persist(snap({ rows, dataSnapshot: data, columnsSnapshot: cols }));
		await backend.persist({
			data: { datasets: [], activeIndex: -1 },
			panel: { charts: [], slots: {}, layout: 'template-2col', blocks: [], nextBlockId: 1, nextChartId: 0 },
			ui: { sidebarMode: 'data' },
		});
		await backend.persist(snap({ rows, dataSnapshot: data, columnsSnapshot: cols }));

		const restored = workers[0].posted.at(-1).snapshot;
		expect(restored.data.datasets[0].rowsCached).toBeUndefined();
		expect(restored.panel.charts[0].dataSnapshotCached).toBeUndefined();
		expect(restored.panel.charts[0].columnsSnapshotCached).toBeUndefined();
		expect(restored.data.datasets[0].rows).toBe(rows);
		expect(restored.panel.charts[0].dataSnapshot).toBe(data);
		expect(restored.panel.charts[0].columnsSnapshot).toBe(cols);
	});
});

describe('workerBackend, needsResync recovery', () => {
	it('rejects needsResync responses for non-persist operations', async () => {
		const backend = createWorkerBackend({
			workerFactory: () => {
				const w = new MockWorker();
				w._deliver = data => queueMicrotask(() => w.emit({ id: data.id, ok: false, needsResync: true }));
				return w;
			},
			fallbackBackendFactory: () => spyFallback(nextDb()),
			timeoutMs: 5000,
		});

		await expect(backend.hydrate()).rejects.toThrow(/non-persist/i);
	});

	it('retries full once on needsResync, persists the originally captured payloads, then dedups them next save', async () => {
		const db = nextDb();
		let nthPersist = 0;
		let worker;
		const backend = createWorkerBackend({
			workerFactory: () => {
				worker = new MockWorker();
				worker._deliver = data => {
					// Force a desync: reject only the very first persist as needsResync;
					// every later message (incl. the full retry) succeeds.
					if (data.op === 'persist') nthPersist += 1;
					const resync = data.op === 'persist' && nthPersist === 1;
					queueMicrotask(() => worker.emit(resync
						? { id: data.id, ok: false, needsResync: true }
						: { id: data.id, ok: true, result: null }));
				};
				return worker;
			},
			fallbackBackendFactory: () => spyFallback(`${db}-fb`),
			timeoutMs: 5000,
		});

		const rows = [{ x: 1 }];
		const s1 = snap({ rows });
		const p = backend.persist(s1);
		// Mutate the live snapshot AFTER the call: the retry must use the captured record, not this.
		s1.data.datasets = [];
		s1.data.activeIndex = -1;
		await p;

		// First message was cache-flagged-or-full; the retry (2nd post) is full and
		// carries the ORIGINAL rows ref, proving no live re-read.
		const retry = worker.posted[1].snapshot;
		expect(retry.data.datasets[0].rows).toBe(rows);
		expect(retry.data.datasets[0].rowsCached).toBeUndefined();

		// sentPayloads was marked from the full retry, so the next save dedups.
		await backend.persist(snap({ rows }));
		const nextMsg = worker.posted[2].snapshot;
		expect(nextMsg.data.datasets[0].rowsCached).toBe(true);
	});

	it('fails the op after a second consecutive needsResync (no infinite loop)', async () => {
		const backend = createWorkerBackend({
			workerFactory: () => {
				const w = new MockWorker();
				w._deliver = data => queueMicrotask(() => w.emit({ id: data.id, ok: false, needsResync: true }));
				return w;
			},
			fallbackBackendFactory: () => spyFallback(nextDb()),
			timeoutMs: 5000,
		});

		await expect(backend.persist(snap())).rejects.toThrow(/resync/i);
	});
});
