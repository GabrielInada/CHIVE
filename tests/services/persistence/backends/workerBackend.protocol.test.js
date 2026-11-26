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
		const workers = [];
		const backend = createWorkerBackend({
			workerFactory: () => { const w = new MockWorker(); attachRealHandler(w, db); workers.push(w); return w; },
			fallbackBackendFactory: () => spyFallback(`${db}-fb`),
			timeoutMs: 5000,
		});

		const rows = [{ x: 3 }, { x: 4 }];
		const bytes = await backend.exportBytes(snap({ rows }));
		const imported = await backend.importBytes(bytes);

		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(imported.data.datasets[0].rows).toEqual(rows);

		const workOnlyBytes = await backend.exportBytes(snap({ rows }), { omitDataPayloads: true });
		const workOnly = await backend.importBytes(workOnlyBytes);
		expect(workOnly.data.datasets[0].rows).toBeNull();

		// The message keeps the former workOnly field, so a page left open across a
		// deploy still talks to a worker started after it.
		const exportMessages = workers[0].posted.filter(message => message.op === 'export');
		expect(exportMessages.map(message => message.workOnly)).toEqual([false, true]);
		expect(exportMessages.some(message => 'omitDataPayloads' in message)).toBe(false);
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

	it('carries the too-large owner from the worker envelope, read defensively', async () => {
		const envelopes = [
			{ name: 'PayloadTooLargeError', message: 'too large', tooLarge: { kind: 'chart', name: 'Totals' } },
			{ name: 'PayloadTooLargeError', message: 'too large', tooLarge: { kind: 'other', name: 42 } },
			{ name: 'Error', message: 'db', tooLarge: 'not an object' },
		];
		const backend = createWorkerBackend({
			workerFactory: () => {
				const w = new MockWorker();
				w._deliver = data => queueMicrotask(() =>
					w.emit({ id: data.id, ok: false, error: envelopes.shift() }));
				return w;
			},
			fallbackBackendFactory: () => spyFallback(nextDb()),
			timeoutMs: 5000,
		});

		await expect(backend.persist(snap())).rejects.toMatchObject({
			name: 'PayloadTooLargeError',
			tooLarge: { kind: 'chart', name: 'Totals' },
		});
		await expect(backend.persist(snap())).rejects.toMatchObject({
			name: 'PayloadTooLargeError',
			tooLarge: { kind: 'dataset', name: '' },
		});
		const error = await backend.persist(snap()).catch(err => err);
		expect(error).toBeInstanceOf(Error);
		expect(error.tooLarge).toBeUndefined();
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
		// The reset nulls worker.onerror, so keep the handler an already-queued
		// error event would still reach. emitError() would be a silent no-op.
		const staleOnError = worker.onerror;
		await delay(60);                                    // watchdog fires (reset #1)
		staleOnError({ message: 'late crash' });            // same dead generation → no-op

		await expect(p).resolves.toBeUndefined();
		expect(fallback.persist).toHaveBeenCalledTimes(1);  // exactly once
		expect(warnSpy).not.toHaveBeenCalled();             // stale onerror returns at the generation guard, before the warn
	});

	describe('a watchdog that fires after its timer was cleared', () => {
		// clearTimeout runs on every settle and reset, so a real timer never
		// fires late. Capture the callbacks and ignore clears to fire one anyway.
		let watchdogs;
		beforeEach(() => {
			watchdogs = [];
			vi.spyOn(globalThis, 'setTimeout').mockImplementation(callback => watchdogs.push(callback));
			vi.spyOn(globalThis, 'clearTimeout').mockImplementation(() => {});
		});

		const stubFallback = () => ({ persist: vi.fn(async () => {}) });
		const acking = worker => {
			worker._deliver = data => queueMicrotask(() => worker.emit({ id: data.id, ok: true, result: null }));
			return worker;
		};

		it('does nothing once its op has settled', async () => {
			const worker = acking(new MockWorker());
			const backend = createWorkerBackend({ workerFactory: () => worker, fallbackBackendFactory: stubFallback });

			await backend.persist(snap());
			watchdogs[0]();

			expect(backend.getDiagnostics()).toMatchObject({ mode: 'worker', fallbackCount: 0 });
			expect(worker.terminated).toBe(false);
		});

		it('does nothing to the replacement worker after a reset', async () => {
			const fallback = stubFallback();
			const workers = [];
			const backend = createWorkerBackend({
				// The first worker answers, so a reset keeps worker mode; the second stays silent.
				workerFactory: () => { const w = new MockWorker(); if (!workers.length) acking(w); workers.push(w); return w; },
				fallbackBackendFactory: () => fallback,
			});

			await backend.persist(snap());
			workers[0].emitError({ message: 'crashed' });   // reset with nothing pending
			const second = backend.persist(snap());           // waits for the drain, then goes to workers[1]
			await vi.waitFor(() => expect(workers[1]?.posted).toHaveLength(1));
			watchdogs[0]();                                   // the first op's watchdog, from the dead generation

			expect(backend.getDiagnostics()).toMatchObject({ mode: 'worker', fallbackCount: 1, pendingOperations: 1 });
			expect(workers[1].terminated).toBe(false);
			workers[1].emit({ id: workers[1].posted[0].id, ok: true, result: null });
			await expect(second).resolves.toBeUndefined();
			expect(fallback.persist).not.toHaveBeenCalled();
		});
	});

	it('ignores a late ok:true from a terminated worker, even for an id pending on its replacement', async () => {
		const db = nextDb();
		const fallback = spyFallback(`${db}-fb`);
		const workers = [];
		const backend = createWorkerBackend({
			workerFactory: () => { const w = new MockWorker(); workers.push(w); return w; }, // silent
			fallbackBackendFactory: () => fallback,
			timeoutMs: 30,
		});

		const rows = [{ x: 1 }];
		const first = backend.persist(snap({ rows }));
		// The reset nulls worker.onmessage, so keep the handler an already-queued
		// message event would still reach. emit() would be a silent no-op.
		const staleOnMessage = workers[0].onmessage;
		await first;                                        // watchdog → fallback, worker[0] terminated
		await delay(0);                                     // first settles inside the drain; let it finish

		const second = backend.persist(snap({ rows }));     // worker[1] spawned, op pending
		const msg = workers[1].posted[0];
		expect(msg.snapshot.data.datasets[0].rowsCached).toBeUndefined(); // reset cleared the cache

		// Only the generation guard stops this: the id matches a live pending op.
		staleOnMessage({ data: { id: msg.id, ok: true, result: null } });
		expect(backend.getDiagnostics().pendingOperations).toBe(1);

		workers[1].emit({ id: msg.id, ok: true, result: null });
		await expect(second).resolves.toBeUndefined();
		expect(fallback.persist).toHaveBeenCalledTimes(1);  // only the first op fell back
	});
});
