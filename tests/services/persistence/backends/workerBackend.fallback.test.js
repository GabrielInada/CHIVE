// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlobBackend } from '../../../../src/services/persistence/backends/blobBackend.js';
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
	sqlite3Ready,
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

describe('workerBackend, watchdog + fallback', () => {
	it('a synchronous postMessage throw before proof drains through fallback and disables worker mode', async () => {
		const fallback = {
			persist: vi.fn(async () => {}),
			hydrate: vi.fn(async () => null),
			clear: vi.fn(async () => {}),
			exportBytes: vi.fn(),
			importBytes: vi.fn(),
		};
		let spawnCalls = 0;
		const backend = createWorkerBackend({
			workerFactory: () => {
				spawnCalls += 1;
				const w = new MockWorker();
				w.postMessage = data => {
					w.posted.push(data);
					throw new Error('post failed');
				};
				return w;
			},
			fallbackBackendFactory: () => fallback,
			timeoutMs: 5000,
		});

		await backend.persist(snap({ rows: [{ x: 1 }] }));
		await backend.persist(snap({ rows: [{ x: 2 }] }));

		expect(fallback.persist).toHaveBeenCalledTimes(2);
		expect(spawnCalls).toBe(1);
	});

	it('a synchronous postMessage throw after proof resets but does not disable future workers', async () => {
		const fallback = {
			persist: vi.fn(async () => {}),
			hydrate: vi.fn(async () => null),
			clear: vi.fn(async () => {}),
			exportBytes: vi.fn(),
			importBytes: vi.fn(),
		};
		const workers = [];
		const backend = createWorkerBackend({
			workerFactory: () => {
				const w = new MockWorker();
				workers.push(w);
				if (workers.length === 1) {
					let calls = 0;
					w._deliver = data => {
						calls += 1;
						if (calls === 1) {
							queueMicrotask(() => w.emit({ id: data.id, ok: true, result: null }));
							return;
						}
						throw new Error('post failed');
					};
				} else {
					w._deliver = data => queueMicrotask(() => w.emit({ id: data.id, ok: true, result: null }));
				}
				return w;
			},
			fallbackBackendFactory: () => fallback,
			timeoutMs: 5000,
		});

		await backend.persist(snap({ rows: [{ x: 1 }] }));
		await backend.persist(snap({ rows: [{ x: 2 }] }));
		await backend.persist(snap({ rows: [{ x: 3 }] }));

		expect(fallback.persist).toHaveBeenCalledTimes(1);
		expect(workers).toHaveLength(2);
	});

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

	it('falls back export, import, hydrate, and clear when worker startup fails', async () => {
		const bytes = new Uint8Array([1, 2, 3]);
		const fallback = {
			hydrate: vi.fn(async () => ({ data: { datasets: [] } })),
			persist: vi.fn(async () => {}),
			exportBytes: vi.fn(async (_snapshot, options) => new Uint8Array(options.workOnly ? [9] : [8])),
			importBytes: vi.fn(async input => ({ imported: Array.from(input) })),
			clear: vi.fn(async () => ({ ok: true })),
		};
		const backend = createWorkerBackend({
			workerFactory: () => { throw new Error('Worker is not defined'); },
			fallbackBackendFactory: () => fallback,
			timeoutMs: 5000,
		});

		await expect(backend.hydrate()).resolves.toEqual({ data: { datasets: [] } });
		await expect(backend.exportBytes(snap(), { workOnly: true })).resolves.toEqual(new Uint8Array([9]));
		await expect(backend.importBytes(bytes)).resolves.toEqual({ imported: [1, 2, 3] });
		// The fallback's clear outcome is forwarded, not swallowed: a caller that
		// reports the wipe to a user needs to know whether it happened.
		await expect(backend.clear()).resolves.toEqual({ ok: true });
		expect(fallback.exportBytes.mock.calls[0][1]).toEqual({ workOnly: true });
	});

	it('rejects fallback import errors using worker-style error normalization', async () => {
		const fallback = {
			hydrate: vi.fn(),
			persist: vi.fn(),
			exportBytes: vi.fn(),
			importBytes: vi.fn(async () => {
				throw { name: 'ImportFailed', message: 'bad bytes' };
			}),
			clear: vi.fn(),
		};
		const backend = createWorkerBackend({
			workerFactory: () => { throw new Error('Worker is not defined'); },
			fallbackBackendFactory: () => fallback,
			timeoutMs: 5000,
		});

		await expect(backend.importBytes(new Uint8Array([1]))).rejects.toMatchObject({
			name: 'ImportFailed',
			message: 'bad bytes',
		});
	});
});

describe('workerBackend, startup failure → disable + fallback', () => {
	it('falls back to JSON cloning when structuredClone is unavailable', async () => {
		const originalStructuredClone = globalThis.structuredClone;
		const fallback = {
			hydrate: vi.fn(),
			clear: vi.fn(),
			persist: vi.fn(async () => {}),
		};
		Object.defineProperty(globalThis, 'structuredClone', { value: undefined, configurable: true });
		const backend = createWorkerBackend({
			workerFactory: () => { throw new Error('Worker is not defined'); },
			fallbackBackendFactory: () => fallback,
			timeoutMs: 5000,
		});

		try {
			const rows = [{ x: 1 }];
			await backend.persist(snap({ rows, withChart: false }));
			rows[0].x = 9;
			expect(fallback.persist.mock.calls[0][0].data.datasets[0].rows).toEqual([{ x: 1 }]);
		} finally {
			Object.defineProperty(globalThis, 'structuredClone', { value: originalStructuredClone, configurable: true });
		}
	});

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
		await expect(pClear).resolves.toEqual({ ok: true });
		expect(fallback.persist).toHaveBeenCalledTimes(1);
	});

	it('logs the full ErrorEvent diagnostics before falling back', async () => {
		const db = nextDb();
		const fallback = spyFallback(`${db}-fb`);
		let worker;
		const backend = createWorkerBackend({
			workerFactory: () => { worker = new MockWorker(); return worker; }, // silent
			fallbackBackendFactory: () => fallback,
			timeoutMs: 5000,
		});

		const workerError = new Error('boom');
		const p = backend.persist(snap());
		worker.emitError({ error: workerError, message: 'crash', filename: 'persistWorker.js', lineno: 42, colno: 7 });

		await expect(p).resolves.toBeUndefined();
		// The same error object is logged (so its stack survives), plus every ErrorEvent field.
		expect(warnSpy).toHaveBeenCalledWith(
			'[chive:persist] worker error; falling back to main thread:',
			expect.objectContaining({ error: workerError, message: 'crash', filename: 'persistWorker.js', lineno: 42, colno: 7 }),
		);
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
		await expect(pClear).resolves.toEqual({ ok: true });
		expect(fallback.clear).toHaveBeenCalledTimes(1);
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
