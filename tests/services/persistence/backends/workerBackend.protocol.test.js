// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	__setPersistWorkerFactoryForTesting,
	createWorkerBackend,
} from '../../../../src/services/persistence/backends/workerBackend.js';
import {
	attachRealHandler,
	delay,
	MockWorker,
	nextDb,
	snap,
	spyFallback,
} from './workerBackend.testSupport.js';

let warnSpy;

beforeEach(() => {
	// onWorkerError logs a diagnostic on every worker `onerror`; mock it so the
	// crash tests stay quiet, and reuse the spy to assert the log shape.
	warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	__setPersistWorkerFactoryForTesting(null);
	vi.restoreAllMocks();
});

describe('workerBackend, happy path + correlation', () => {
	it('uses the default worker factory test seam when no instance factory is passed', async () => {
		const worker = new MockWorker();
		worker._deliver = data => queueMicrotask(() => worker.emit({ id: data.id, ok: true, result: null }));
		__setPersistWorkerFactoryForTesting(() => worker);
		const backend = createWorkerBackend({
			fallbackBackendFactory: () => spyFallback(nextDb()),
			timeoutMs: 5000,
		});

		await backend.persist(snap());

		expect(worker.posted[0].op).toBe('persist');
	});

	it('reports unavailable and avoids spawning a worker when indexedDB is missing for hydrate', async () => {
		const originalIndexedDB = globalThis.indexedDB;
		let spawnCalls = 0;
		Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
		const backend = createWorkerBackend({
			workerFactory: () => { spawnCalls += 1; return new MockWorker(); },
			fallbackBackendFactory: () => spyFallback(nextDb()),
			timeoutMs: 5000,
		});

		try {
			expect(backend.available()).toBe(false);
			await expect(backend.hydrate()).resolves.toBeNull();
			expect(spawnCalls).toBe(0);
		} finally {
			Object.defineProperty(globalThis, 'indexedDB', { value: originalIndexedDB, configurable: true });
		}
	});

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

	it('exports and imports project bytes through the worker', async () => {
		const db = nextDb();
		const backend = createWorkerBackend({
			workerFactory: () => { const w = new MockWorker(); attachRealHandler(w, db); return w; },
			fallbackBackendFactory: () => spyFallback(`${db}-fb`),
			timeoutMs: 5000,
		});

		const rows = [{ x: 3 }, { x: 4 }];
		const bytes = await backend.exportBytes(snap({ rows }));
		const imported = await backend.importBytes(bytes);

		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(imported.data.datasets[0].rows).toEqual(rows);

		const workOnlyBytes = await backend.exportBytes(snap({ rows }), { workOnly: true });
		const workOnly = await backend.importBytes(workOnlyBytes);
		expect(workOnly.data.datasets[0].rows).toBeNull();
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

	it('ignores unknown response ids and then resolves the matching op', async () => {
		let worker;
		const backend = createWorkerBackend({
			workerFactory: () => {
				worker = new MockWorker();
				worker._deliver = data => queueMicrotask(() => {
					worker.emit({ id: data.id + 100, ok: true, result: 'stale' });
					worker.emit({ id: data.id, ok: true, result: null });
				});
				return worker;
			},
			fallbackBackendFactory: () => spyFallback(nextDb()),
			timeoutMs: 5000,
		});

		await expect(backend.persist(snap())).resolves.toBeUndefined();
		expect(worker.posted).toHaveLength(1);
	});

	it('clones typed-array and ArrayBuffer import payloads before posting', async () => {
		const workers = [];
		const backend = createWorkerBackend({
			workerFactory: () => {
				const w = new MockWorker();
				w._deliver = data => queueMicrotask(() => w.emit({ id: data.id, ok: true, result: { ok: true } }));
				workers.push(w);
				return w;
			},
			fallbackBackendFactory: () => spyFallback(nextDb()),
			timeoutMs: 5000,
		});

		const source = new Uint8Array([1, 2, 3, 4]);
		const view = new Uint8Array(source.buffer, 1, 2);
		await backend.importBytes(view);
		source[1] = 99;
		expect(Array.from(workers[0].posted[0].bytes)).toEqual([2, 3]);

		const buffer = new Uint8Array([5, 6, 7]).buffer;
		await backend.importBytes(buffer);
		expect(Array.from(workers[0].posted[1].bytes)).toEqual([5, 6, 7]);
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
		expect(warnSpy).not.toHaveBeenCalled();             // stale onerror returns at the gen guard, before the warn
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
