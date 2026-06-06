// @vitest-environment jsdom

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { createBlobBackend } from '../../../src/services/persistence/blobBackend.js';
import { createPersistHandler } from '../../../src/workers/persistWorker.js';
import { createWorkerBackend } from '../../../src/services/persistence/workerBackend.js';

let sqlite3Ready;
let counter = 0;

beforeAll(() => {
	sqlite3Ready = sqlite3InitModule().then(sqlite3 => {
		sqlite3.config.log = () => {};
		sqlite3.config.warn = () => {};
		return sqlite3;
	});
});

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Flexible Worker double. `postMessage` records the message and optionally
// hands it to a `_deliver(data, self)` driver (a real handler for round-trips,
// or a script for forced responses). `emit` / `emitError` simulate the worker
// posting back / crashing.
class MockWorker {
	constructor() {
		this.onmessage = null;
		this.onerror = null;
		this.terminated = false;
		this.posted = [];
		this._deliver = null;
	}
	postMessage(data) {
		this.posted.push(data);
		if (this._deliver) this._deliver(data, this);
	}
	terminate() { this.terminated = true; }
	emit(message) { if (this.onmessage) this.onmessage({ data: message }); }
	emitError(event = {}) { if (this.onerror) this.onerror(event); }
}

// Back a MockWorker with a real createPersistHandler + real SQLite backend, so
// postMessage → reconstruct → SQLite write → emit, exactly like production.
function attachRealHandler(worker, dbName, gate) {
	const backend = createBlobBackend({ initSqlite: () => sqlite3Ready, dbName });
	const handler = createPersistHandler(backend, msg => worker.emit(msg));
	worker._deliver = data => {
		if (gate && !gate()) return;     // gated workers stop responding (hang)
		void handler.handleMessage(data);
	};
	worker._backend = backend;
}

function spyFallback(dbName) {
	const real = createBlobBackend({ initSqlite: () => sqlite3Ready, dbName });
	return {
		available: () => real.available(),
		hydrate: vi.fn(() => real.hydrate()),
		persist: vi.fn(snapshot => real.persist(snapshot)),
		clear: vi.fn(() => real.clear()),
	};
}

// Build a persistence-shaped snapshot. Pass explicit payload refs to simulate
// the immutable-per-id invariant across saves (reuse the same ref = unchanged).
function snap({ rows, dataSnapshot, columnsSnapshot, activeIndex = 0, withChart = true } = {}) {
	const datasetRows = rows || [{ x: 1 }];
	const chartData = dataSnapshot || [{ x: 1 }];
	const chartCols = columnsSnapshot || [{ name: 'x', type: 'number' }];
	return {
		data: {
			datasets: [{
				id: 'ds-1',
				name: 'a.csv',
				rows: datasetRows,
				columns: [{ name: 'x', type: 'number' }],
				selectedColumns: ['x'],
				chartConfig: {},
			}],
			activeIndex,
		},
		panel: withChart
			? {
				charts: [{ id: 0, type: 'bar', config: {}, dataSnapshot: chartData, columnsSnapshot: chartCols }],
				slots: {}, layout: 'template-2col', blocks: [], nextBlockId: 1, nextChartId: 1,
			}
			: { charts: [], slots: {}, layout: 'template-2col', blocks: [], nextBlockId: 1, nextChartId: 0 },
		ui: { sidebarMode: 'data', previewRows: 10 },
	};
}

function nextDb() {
	counter += 1;
	return `wb-test-${counter}`;
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('workerBackend, happy path + correlation', () => {
	it('round-trips persist → hydrate through the worker', async () => {
		const db = nextDb();
		const workers = [];
		const backend = createWorkerBackend({
			workerFactory: () => { const w = new MockWorker(); attachRealHandler(w, db); workers.push(w); return w; },
			fallbackBackendFactory: () => spyFallback(`${db}-fb`),
			timeoutMs: 5000,
		});

		const rows = [{ x: 1 }, { x: 2 }];
		await backend.persist(snap({ rows }));
		const hydrated = await backend.hydrate();

		expect(hydrated.data.datasets[0].id).toBe('ds-1');
		expect(hydrated.data.datasets[0].rows).toEqual(rows);
		expect(workers).toHaveLength(1);     // single long-lived worker reused
	});

	it('returns null on first hydrate and after clear', async () => {
		const db = nextDb();
		const backend = createWorkerBackend({
			workerFactory: () => { const w = new MockWorker(); attachRealHandler(w, db); return w; },
			fallbackBackendFactory: () => spyFallback(`${db}-fb`),
			timeoutMs: 5000,
		});

		expect(await backend.hydrate()).toBeNull();
		await backend.persist(snap());
		await backend.clear();
		expect(await backend.hydrate()).toBeNull();
	});

	it('preserves QuotaExceededError.name back to the host', async () => {
		const backend = createWorkerBackend({
			workerFactory: () => {
				const w = new MockWorker();
				w._deliver = data => queueMicrotask(() =>
					w.emit({ id: data.id, ok: false, error: { name: 'QuotaExceededError', message: 'quota' } }));
				return w;
			},
			fallbackBackendFactory: () => spyFallback(nextDb()),
			timeoutMs: 5000,
		});

		await expect(backend.persist(snap())).rejects.toMatchObject({ name: 'QuotaExceededError' });
	});

	it('correlates two concurrent ops by id', async () => {
		const db = nextDb();
		const backend = createWorkerBackend({
			workerFactory: () => { const w = new MockWorker(); attachRealHandler(w, db); return w; },
			fallbackBackendFactory: () => spyFallback(`${db}-fb`),
			timeoutMs: 5000,
		});

		await backend.persist(snap({ rows: [{ x: 9 }] }));
		const [hydrated] = await Promise.all([backend.hydrate(), backend.persist(snap({ rows: [{ x: 9 }] }))]);
		expect(hydrated.data.datasets[0].rows).toEqual([{ x: 9 }]);
	});

	it('registers pending before postMessage (a synchronous reply still resolves)', async () => {
		const backend = createWorkerBackend({
			workerFactory: () => {
				const w = new MockWorker();
				w._deliver = data => w.emit({ id: data.id, ok: true, result: null }); // synchronous, inside postMessage
				return w;
			},
			fallbackBackendFactory: () => spyFallback(nextDb()),
			timeoutMs: 5000,
		});

		await expect(backend.persist(snap())).resolves.toBeUndefined();
	});
});

describe('workerBackend, watchdog + fallback', () => {
	it('a timeout completes the op via the fallback from the captured record (edit not lost)', async () => {
		const db = nextDb();
		const fallback = spyFallback(`${db}-fb`);
		const backend = createWorkerBackend({
			workerFactory: () => new MockWorker(),          // silent: never responds
			fallbackBackendFactory: () => fallback,
			timeoutMs: 30,
		});

		const rows = [{ x: 42 }];
		await backend.persist(snap({ rows }));              // resolves via fallback after watchdog

		expect(fallback.persist).toHaveBeenCalledTimes(1);
		const persisted = await fallback.hydrate();
		expect(persisted.data.datasets[0].rows).toEqual(rows);
	});

	it('a post-success timeout resets but does NOT disable worker mode', async () => {
		const db = nextDb();
		let respond = true;
		const workers = [];
		const backend = createWorkerBackend({
			workerFactory: () => { const w = new MockWorker(); attachRealHandler(w, db, () => respond); workers.push(w); return w; },
			fallbackBackendFactory: () => spyFallback(`${db}-fb`),
			timeoutMs: 40,
		});

		await backend.persist(snap());                      // worker proven
		respond = false;
		await backend.persist(snap());                      // hangs → watchdog → fallback
		respond = true;
		await backend.persist(snap());                      // a fresh worker is spawned (not disabled)

		expect(workers.length).toBeGreaterThanOrEqual(2);
	});
});

describe('workerBackend, startup failure → disable + fallback', () => {
	it('a synchronous spawn throw falls back from the record and disables worker mode', async () => {
		const db = nextDb();
		const fallback = spyFallback(`${db}-fb`);
		let spawnCalls = 0;
		const backend = createWorkerBackend({
			workerFactory: () => { spawnCalls += 1; throw new Error('Worker is not defined'); },
			fallbackBackendFactory: () => fallback,
			timeoutMs: 5000,
		});

		await backend.persist(snap({ rows: [{ x: 1 }] }));
		await backend.persist(snap({ rows: [{ x: 2 }] }));

		expect(fallback.persist).toHaveBeenCalledTimes(2);
		expect(spawnCalls).toBe(1);                         // disabled after the first failure, never retried
	});

	it('fallback persist clones the captured payload before any async fallback work', async () => {
		const rows = [{ x: 1 }];
		const fallback = {
			hydrate: vi.fn(),
			clear: vi.fn(),
			persist: vi.fn(async () => {}),
		};
		const backend = createWorkerBackend({
			workerFactory: () => { throw new Error('Worker is not defined'); },
			fallbackBackendFactory: () => fallback,
			timeoutMs: 5000,
		});

		const save = backend.persist(snap({ rows, withChart: false }));
		rows[0].x = 99;
		rows.push({ x: 2 });
		await save;

		expect(fallback.persist).toHaveBeenCalledTimes(1);
		expect(fallback.persist.mock.calls[0][0].data.datasets[0].rows).toEqual([{ x: 1 }]);
	});

	it('an async onerror at startup falls back and disables worker mode', async () => {
		const db = nextDb();
		const fallback = spyFallback(`${db}-fb`);
		let spawnCalls = 0;
		const backend = createWorkerBackend({
			workerFactory: () => {
				spawnCalls += 1;
				const w = new MockWorker();
				w._deliver = () => queueMicrotask(() => w.emitError({ message: 'load failed' }));
				return w;
			},
			fallbackBackendFactory: () => fallback,
			timeoutMs: 5000,
		});

		await backend.persist(snap());
		await backend.persist(snap());

		expect(fallback.persist).toHaveBeenCalledTimes(2);
		expect(spawnCalls).toBe(1);
	});
});

describe('workerBackend, crash drains every pending op serially in send order', () => {
	it('drains a persist + hydrate + clear crash, none left hanging', async () => {
		const db = nextDb();
		const fallback = spyFallback(`${db}-fb`);
		let worker;
		const backend = createWorkerBackend({
			workerFactory: () => { worker = new MockWorker(); return worker; }, // silent
			fallbackBackendFactory: () => fallback,
			timeoutMs: 5000,
		});

		const pPersist = backend.persist(snap({ rows: [{ x: 1 }] }));
		const pHydrate = backend.hydrate();
		const pClear = backend.clear();

		worker.emitError({ message: 'crash' });             // one onerror drains all three

		await expect(pPersist).resolves.toBeUndefined();
		await expect(pHydrate).resolves.not.toThrow;
		await expect(pClear).resolves.toBeUndefined();
		expect(fallback.persist).toHaveBeenCalledTimes(1);
	});

	it('drains pending persist → clear in order (clear wins, store ends empty)', async () => {
		const db = nextDb();
		const fallback = spyFallback(`${db}-fb`);
		let worker;
		const backend = createWorkerBackend({
			workerFactory: () => { worker = new MockWorker(); return worker; },
			fallbackBackendFactory: () => fallback,
			timeoutMs: 5000,
		});

		const p1 = backend.persist(snap());
		const p2 = backend.clear();
		worker.emitError({ message: 'crash' });
		await Promise.all([p1, p2]);

		expect(await fallback.hydrate()).toBeNull();        // clear ran after persist
	});

	it('drains pending clear → persist in order (persist wins, store ends populated)', async () => {
		const db = nextDb();
		const fallback = spyFallback(`${db}-fb`);
		let worker;
		const backend = createWorkerBackend({
			workerFactory: () => { worker = new MockWorker(); return worker; },
			fallbackBackendFactory: () => fallback,
			timeoutMs: 5000,
		});

		const p1 = backend.clear();
		const p2 = backend.persist(snap({ rows: [{ x: 7 }] }));
		worker.emitError({ message: 'crash' });
		await Promise.all([p1, p2]);

		const hydrated = await fallback.hydrate();
		expect(hydrated.data.datasets[0].rows).toEqual([{ x: 7 }]);
	});

	it('continues draining after a per-op fallback failure', async () => {
		const db = nextDb();
		const fallback = spyFallback(`${db}-fb`);
		fallback.persist.mockImplementationOnce(() => Promise.reject(Object.assign(new Error('quota'), { name: 'QuotaExceededError' })));
		let worker;
		const backend = createWorkerBackend({
			workerFactory: () => { worker = new MockWorker(); return worker; },
			fallbackBackendFactory: () => fallback,
			timeoutMs: 5000,
		});

		const pPersist = backend.persist(snap());           // first fallback op: fails
		const pClear = backend.clear();                     // second fallback op: must still run
		worker.emitError({ message: 'crash' });

		await expect(pPersist).rejects.toMatchObject({ name: 'QuotaExceededError' });
		await expect(pClear).resolves.toBeUndefined();
		expect(fallback.clear).toHaveBeenCalledTimes(1);
	});
});

describe('workerBackend, reset is idempotent + stale responses ignored', () => {
	it('a watchdog and an onerror for the same generation drain once', async () => {
		const db = nextDb();
		const fallback = spyFallback(`${db}-fb`);
		let worker;
		const backend = createWorkerBackend({
			workerFactory: () => { worker = new MockWorker(); return worker; },
			fallbackBackendFactory: () => fallback,
			timeoutMs: 30,
		});

		const p = backend.persist(snap());
		await delay(60);                                    // watchdog fires (reset #1)
		worker.emitError({ message: 'late crash' });        // same dead generation → no-op

		await expect(p).resolves.toBeUndefined();
		expect(fallback.persist).toHaveBeenCalledTimes(1);  // exactly once
	});

	it('ignores a late ok:true from an already-terminated worker (no sentPayloads write)', async () => {
		const db = nextDb();
		const fallback = spyFallback(`${db}-fb`);
		const workers = [];
		const backend = createWorkerBackend({
			workerFactory: () => { const w = new MockWorker(); workers.push(w); return w; }, // silent
			fallbackBackendFactory: () => fallback,
			timeoutMs: 30,
		});

		const rows = [{ x: 1 }];
		await backend.persist(snap({ rows }));              // watchdog → fallback, worker[0] terminated
		workers[0].emit({ id: 1, ok: true, result: null }); // late, stale, must be ignored

		// Next save spawns worker[1]; sentPayloads must still be empty → full payloads.
		await delay(40);
		const p = backend.persist(snap({ rows }));
		await delay(40);
		const msg = workers[1].posted[0];
		expect(msg.snapshot.data.datasets[0].rowsCached).toBeUndefined();
		expect(Array.isArray(msg.snapshot.data.datasets[0].rows)).toBe(true);
		// settle the second op so the test does not leak a pending promise
		await delay(40);
		await p.catch(() => {});
	});
});

describe('workerBackend, new ops queue behind an in-progress drain', () => {
	it('a persist during a held-open drain runs only after the drain completes', async () => {
		const db = nextDb();
		let releaseFallback;
		const real = createBlobBackend({ initSqlite: () => sqlite3Ready, dbName: `${db}-fb` });
		const order = [];
		const fallback = {
			available: () => real.available(),
			hydrate: () => real.hydrate(),
			clear: () => real.clear(),
			persist: vi.fn(async snapshot => {
				order.push('drain-fallback-start');
				await new Promise(resolve => { releaseFallback = resolve; });
				order.push('drain-fallback-end');
				return real.persist(snapshot);
			}),
		};
		const workers = [];
		const backend = createWorkerBackend({
			workerFactory: () => { const w = new MockWorker(); attachRealHandler(w, db); workers.push(w); return w; },
			fallbackBackendFactory: () => fallback,
			timeoutMs: 5000,
		});

		await backend.persist(snap({ rows: [{ x: 0 }] }));  // worker[0] proven → a later crash resets (not disables)

		const p1 = backend.persist(snap({ rows: [{ x: 1 }] }));
		workers[0].emitError({ message: 'crash' });         // p1 drains via the held-open fallback
		await delay(20);
		expect(fallback.persist).toHaveBeenCalledTimes(1);

		// New persist arrives mid-drain: captured now, but execution deferred behind drainPromise.
		const p2 = backend.persist(snap({ rows: [{ x: 2 }] }));
		await delay(20);
		order.push('p2-requested');
		expect(workers).toHaveLength(1);                    // no fresh worker while the drain is held

		releaseFallback();
		await Promise.all([p1, p2]);

		expect(workers).toHaveLength(2);                    // p2 ran on a fresh worker AFTER the drain
		expect(order).toEqual(['drain-fallback-start', 'p2-requested', 'drain-fallback-end']);
	});
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
});

describe('workerBackend, needsResync recovery', () => {
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
