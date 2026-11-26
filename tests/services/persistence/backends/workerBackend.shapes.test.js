// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	__setPersistWorkerFactoryForTesting,
	createWorkerBackend,
} from '../../../../src/services/persistence/backends/workerBackend.js';
import { attachRealHandler, MockWorker, nextDb, snap } from './workerBackend.testSupport.js';

/** A worker that acknowledges every request on the next microtask. */
function ackingWorker() {
	const worker = new MockWorker();
	worker._deliver = data => queueMicrotask(() => worker.emit({ id: data.id, ok: true, result: null }));
	return worker;
}

function stubFallback() {
	return {
		hydrate: vi.fn(async () => null),
		persist: vi.fn(async () => {}),
		exportBytes: vi.fn(async () => new Uint8Array()),
		importBytes: vi.fn(async () => null),
		clear: vi.fn(async () => undefined),
	};
}

afterEach(() => {
	__setPersistWorkerFactoryForTesting(null);
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('workerBackend, snapshot shapes on the wire', () => {
	it('sends an empty envelope when the snapshot has no data or a non-object panel', async () => {
		const worker = ackingWorker();
		const backend = createWorkerBackend({ workerFactory: () => worker, fallbackBackendFactory: stubFallback });

		await backend.persist(undefined);
		await backend.persist({ panel: 'not-a-panel', ui: { sidebarMode: 'data' } });

		expect(worker.posted[0].snapshot).toEqual({ data: { datasets: [], activeIndex: -1 }, panel: null });
		expect(worker.posted[1].snapshot).toEqual({
			data: { datasets: [], activeIndex: -1 },
			panel: null,
			ui: { sidebarMode: 'data' },
		});

		const fallback = stubFallback();
		const noWorker = createWorkerBackend({
			workerFactory: () => { throw new Error('Worker is not defined'); },
			fallbackBackendFactory: () => fallback,
		});
		await noWorker.persist(undefined);
		expect(fallback.persist.mock.calls[0][0]).toEqual({ data: { datasets: [], activeIndex: -1 }, panel: null });
	});

	it('sends non-array payloads as empty arrays', async () => {
		const worker = ackingWorker();
		const backend = createWorkerBackend({ workerFactory: () => worker, fallbackBackendFactory: stubFallback });
		const snapshot = snap();
		// Truthy array-likes, so the capture step is what rejects them, not a later `|| []`.
		snapshot.data.datasets[0].rows = { 0: { x: 1 }, length: 1 };
		snapshot.panel.charts[0].dataSnapshot = 'corrupt';
		delete snapshot.panel.charts[0].columnsSnapshot;
		snapshot.panel.blocks = [{
			id: 'block-1',
			slots: { 'slot-1': 0 },
			placements: { 'slot-1': { followGlobalFilter: true, dataSnapshot: {}, columnsSnapshot: undefined } },
		}];

		await backend.persist(snapshot);

		const sent = worker.posted[0].snapshot;
		expect(sent.data.datasets[0].rows).toEqual([]);
		expect(sent.panel.charts[0]).toMatchObject({ dataSnapshot: [], columnsSnapshot: [] });
		expect(sent.panel.blocks[0].placements['slot-1']).toEqual({
			followGlobalFilter: true,
			dataSnapshot: [],
			columnsSnapshot: [],
		});
	});

	it('saves a dataset without an id and a chart without an integer id with empty payloads', async () => {
		const snapshot = snap();
		delete snapshot.data.datasets[0].id;
		snapshot.panel.charts[0].id = 'not-a-number';

		const worker = new MockWorker();
		attachRealHandler(worker, nextDb());
		const backend = createWorkerBackend({ workerFactory: () => worker, fallbackBackendFactory: stubFallback });
		await backend.persist(snapshot);

		const sent = worker.posted.at(-1).snapshot;
		expect(sent.data.datasets[0]).toMatchObject({ name: 'a.csv', rows: [] });
		expect(sent.panel.charts[0]).toMatchObject({ id: 'not-a-number', dataSnapshot: [], columnsSnapshot: [] });

		const fallback = stubFallback();
		const noWorker = createWorkerBackend({
			workerFactory: () => { throw new Error('Worker is not defined'); },
			fallbackBackendFactory: () => fallback,
		});
		await noWorker.persist(snapshot);
		const saved = fallback.persist.mock.calls[0][0];
		expect(saved.data.datasets[0]).toMatchObject({ name: 'a.csv', rows: [] });
		expect(saved.panel.charts[0]).toMatchObject({ id: 'not-a-number', dataSnapshot: [], columnsSnapshot: [] });
	});

	it('posts import bytes that are neither a typed array nor an ArrayBuffer as they are', async () => {
		const worker = ackingWorker();
		const backend = createWorkerBackend({ workerFactory: () => worker, fallbackBackendFactory: stubFallback });
		const notBytes = { length: 2 };

		await backend.importBytes(notBytes);

		expect(worker.posted[0]).toMatchObject({ op: 'import' });
		expect(worker.posted[0].bytes).toBe(notBytes);
	});

	it('treats a non-array chart list as no charts', async () => {
		const worker = ackingWorker();
		const backend = createWorkerBackend({ workerFactory: () => worker, fallbackBackendFactory: stubFallback });

		await backend.persist({ data: { datasets: [], activeIndex: 0 }, panel: { charts: 'corrupt', layout: 'template-2col' } });

		expect(worker.posted[0].snapshot.panel).toEqual({ charts: [], layout: 'template-2col' });
	});

	it('leaves blocks off a panel that has none, both to the worker and to the fallback', async () => {
		const panel = { charts: [], layout: 'template-2col' };
		const worker = ackingWorker();
		const backend = createWorkerBackend({ workerFactory: () => worker, fallbackBackendFactory: stubFallback });

		await backend.persist({ data: { datasets: [] }, panel });
		expect(worker.posted[0].snapshot.panel).not.toHaveProperty('blocks');

		const fallback = stubFallback();
		const noWorker = createWorkerBackend({
			workerFactory: () => { throw new Error('Worker is not defined'); },
			fallbackBackendFactory: () => fallback,
		});
		await noWorker.persist({ data: { datasets: [] }, panel });
		expect(fallback.persist.mock.calls[0][0].panel).not.toHaveProperty('blocks');
	});
});

describe('workerBackend, worker replies', () => {
	it('rejects with a generic Error when the failure envelope carries no message or name', async () => {
		const worker = new MockWorker();
		worker._deliver = data => queueMicrotask(() => worker.emit({ id: data.id, ok: false }));
		const backend = createWorkerBackend({ workerFactory: () => worker, fallbackBackendFactory: stubFallback });

		const error = await backend.persist(snap()).catch(err => err);

		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe('Error');
		expect(error.message).toBe('persistence worker error');
		expect(error).not.toHaveProperty('tooLarge');
	});

	it('ignores a message event without data and still settles on the real reply', async () => {
		const worker = new MockWorker();
		worker._deliver = data => queueMicrotask(() => {
			worker.onmessage({});
			worker.emit({ id: data.id, ok: true, result: { restored: true } });
		});
		const backend = createWorkerBackend({ workerFactory: () => worker, fallbackBackendFactory: stubFallback });

		await expect(backend.hydrate()).resolves.toEqual({ restored: true });
	});
});

describe('workerBackend, fallback outcomes', () => {
	it('resolves a fallback clear that reports nothing as null', async () => {
		const fallback = stubFallback();
		const backend = createWorkerBackend({
			workerFactory: () => { throw new Error('Worker is not defined'); },
			fallbackBackendFactory: () => fallback,
		});

		await expect(backend.clear()).resolves.toBeNull();
		expect(fallback.clear).toHaveBeenCalledTimes(1);
	});

	it('keeps worker mode after a spawn failure once a worker has already answered', async () => {
		const fallback = stubFallback();
		const workers = [];
		let spawnFails = false;
		const backend = createWorkerBackend({
			workerFactory: () => {
				if (spawnFails) throw new Error('spawn blocked');
				const worker = ackingWorker();
				workers.push(worker);
				return worker;
			},
			fallbackBackendFactory: () => fallback,
		});

		await backend.persist(snap());                       // worker proven
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		workers[0].emitError({ message: 'crashed' });        // reset, nothing pending
		spawnFails = true;
		await backend.persist(snap());                       // spawn throws, op goes to the fallback

		expect(fallback.persist).toHaveBeenCalledTimes(1);
		expect(backend.getDiagnostics()).toMatchObject({ workerDisabled: false, lastFallbackReason: 'spawn-error' });

		spawnFails = false;
		await backend.persist(snap());                       // a fresh worker is tried again
		expect(workers).toHaveLength(2);
		expect(fallback.persist).toHaveBeenCalledTimes(1);
	});
});

describe('workerBackend, default worker construction', () => {
	it('spawns the persist worker as a module worker resolved next to the source', async () => {
		const constructed = [];
		vi.stubGlobal('Worker', class {
			constructor(url, options) {
				constructed.push({ url: String(url), options });
				this.onmessage = null;
			}
			postMessage(data) {
				queueMicrotask(() => this.onmessage({ data: { id: data.id, ok: true, result: null } }));
			}
			terminate() {}
		});
		const backend = createWorkerBackend({ fallbackBackendFactory: stubFallback });

		await backend.clear();

		expect(constructed).toHaveLength(1);
		// Vite's worker transform appends a query; the path is what the source controls.
		expect(new URL(constructed[0].url).pathname).toMatch(/\/src\/workers\/persistWorker\.js$/);
		expect(constructed[0].options).toEqual({ type: 'module' });
	});
});
