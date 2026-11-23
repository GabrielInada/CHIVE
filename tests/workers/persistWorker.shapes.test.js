// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPersistHandler } from '../../src/workers/persistWorker.js';

function spyBackend(overrides = {}) {
	return {
		persist: vi.fn(() => Promise.resolve()),
		hydrate: vi.fn(() => Promise.resolve(undefined)),
		exportBytes: vi.fn(() => Promise.resolve(new Uint8Array())),
		importBytes: vi.fn(() => Promise.resolve(null)),
		clear: vi.fn(() => Promise.resolve()),
		...overrides,
	};
}

function handler(backend = spyBackend()) {
	const posts = [];
	const h = createPersistHandler(backend, message => posts.push(message));
	return { h, backend, posts, persisted: index => backend.persist.mock.calls[index][0] };
}

const persist = (id, snapshot) => ({ id, op: 'persist', snapshot });

describe('persistWorker, snapshot shapes', () => {
	it('persists an empty dataset list and a null panel for a bare snapshot', async () => {
		const { h, posts, persisted } = handler();

		await h.handleMessage(persist(1, { data: { datasets: 'corrupt' }, panel: 'corrupt' }));

		expect(persisted(0).data.datasets).toEqual([]);
		expect(persisted(0).panel).toBeNull();
		expect(posts).toEqual([{ id: 1, ok: true, result: null }]);
	});

	it('empties non-array rows and does not cache a dataset without an id', async () => {
		const { h, persisted } = handler();

		await h.handleMessage(persist(1, { data: { datasets: [{ id: 'ds-1', rows: 'corrupt' }, { name: 'no id', rows: [{ a: 1 }] }] } }));

		expect(persisted(0).data.datasets.map(ds => ds.rows)).toEqual([[], [{ a: 1 }]]);
		expect([...h.rowsCache.keys()]).toEqual(['ds-1']);
	});

	it('empties non-array chart payloads and caches only charts with integer ids', async () => {
		const { h, persisted } = handler();

		await h.handleMessage(persist(1, {
			data: { datasets: [] },
			panel: {
				charts: [
					{ id: 4, dataSnapshot: 'corrupt', columnsSnapshot: { a: 1 } },
					{ id: 'draft', dataSnapshot: [{ a: 1 }], columnsSnapshot: [] },
				],
			},
		}));

		expect(persisted(0).panel.charts[0]).toEqual({ id: 4, dataSnapshot: [], columnsSnapshot: [] });
		expect(persisted(0).panel).not.toHaveProperty('blocks');
		expect([...h.snapshotCache.keys()]).toEqual([4]);
	});

	it('treats a non-array chart list as no charts', async () => {
		const { h, persisted } = handler();

		await h.handleMessage(persist(1, { data: { datasets: [] }, panel: { charts: 'corrupt', layout: 'template-2col' } }));

		expect(persisted(0).panel).toEqual({ charts: [], layout: 'template-2col' });
	});

	it('refills cached columns independently of fresh chart rows', async () => {
		const { h, persisted } = handler();
		const cols = [{ name: 'a', type: 'number' }];
		const chart = { id: 4, dataSnapshot: [{ a: 1 }], columnsSnapshot: cols };
		await h.handleMessage(persist(1, { data: { datasets: [] }, panel: { charts: [chart] } }));

		const freshRows = [{ a: 2 }];
		await h.handleMessage(persist(2, {
			data: { datasets: [] },
			panel: { charts: [{ id: 4, dataSnapshot: freshRows, columnsSnapshotCached: true }] },
		}));

		const refilled = persisted(1).panel.charts[0];
		expect(refilled.dataSnapshot).toBe(freshRows);
		expect(refilled.columnsSnapshot).toBe(cols);
		expect(refilled).not.toHaveProperty('columnsSnapshotCached');
	});

	it.each([
		['rows', { dataSnapshotCached: true, columnsSnapshot: [] }],
		['columns', { dataSnapshot: [], columnsSnapshotCached: true }],
	])('asks for a resync when cached chart %s are missing', async (_label, payloads) => {
		const { h, backend, posts } = handler();

		await h.handleMessage(persist(1, { data: { datasets: [] }, panel: { charts: [{ id: 4, ...payloads }] } }));

		expect(backend.persist).not.toHaveBeenCalled();
		expect(posts).toEqual([{ id: 1, ok: false, needsResync: true }]);
	});
});

describe('persistWorker, slot captures', () => {
	const panelWith = placement => ({
		charts: [],
		blocks: [{ id: 'block-1', slots: { 'slot-1': 4 }, placements: { 'slot-1': placement } }],
	});

	it('refills cached slot captures and strips the cached flags', async () => {
		const { h, persisted } = handler();
		const dataSnapshot = [{ a: 1 }];
		const columnsSnapshot = [{ name: 'a' }];
		await h.handleMessage(persist(1, { data: { datasets: [] }, panel: panelWith({ followGlobalFilter: false, dataSnapshot, columnsSnapshot }) }));

		await h.handleMessage(persist(2, {
			data: { datasets: [] },
			panel: panelWith({ followGlobalFilter: false, dataSnapshotCached: true, columnsSnapshotCached: true }),
		}));

		expect(persisted(1).panel.blocks[0].placements['slot-1']).toEqual({ followGlobalFilter: false, dataSnapshot, columnsSnapshot });
	});

	it('empties a slot capture the host sent without payloads', async () => {
		const { h, persisted } = handler();

		await h.handleMessage(persist(1, { data: { datasets: [] }, panel: panelWith({ followGlobalFilter: true }) }));

		expect(persisted(0).panel.blocks[0].placements['slot-1']).toEqual({
			followGlobalFilter: true,
			dataSnapshot: [],
			columnsSnapshot: [],
		});
	});

	it.each([
		['rows', { dataSnapshotCached: true, columnsSnapshot: [] }],
		['columns', { dataSnapshot: [], columnsSnapshotCached: true }],
	])('asks for a resync when cached slot %s are missing', async (_label, placement) => {
		const { h, backend, posts } = handler();

		await h.handleMessage(persist(1, { data: { datasets: [] }, panel: panelWith(placement) }));

		expect(backend.persist).not.toHaveBeenCalled();
		expect(posts).toEqual([{ id: 1, ok: false, needsResync: true }]);
		expect(h.placementCache.size).toBe(0);
	});
});

describe('persistWorker, replies', () => {
	it('answers a hydrate that finds nothing with null', async () => {
		const { h, posts } = handler();

		await h.handleMessage({ id: 1, op: 'hydrate' });

		expect(posts).toEqual([{ id: 1, ok: true, result: null }]);
	});

	it('rejects an unknown op without touching the backend', async () => {
		const { h, backend, posts } = handler();

		await h.handleMessage({ id: 1, op: 'vacuum' });

		expect(posts).toEqual([{ id: 1, ok: false, error: { name: 'Error', message: 'Unknown persist op: vacuum' } }]);
		expect(Object.values(backend).every(fn => fn.mock.calls.length === 0)).toBe(true);
	});

	it('fills in a generic name and message when the backend throws a bare value', async () => {
		const { h, posts } = handler(spyBackend({ clear: () => Promise.reject({}) }));

		await h.handleMessage({ id: 1, op: 'clear' });

		expect(posts).toEqual([{ id: 1, ok: false, error: { name: 'Error', message: 'persist worker error' } }]);
	});
});

describe('persistWorker, worker scope', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it('registers no handler outside a dedicated worker scope', async () => {
		const scope = {};
		vi.stubGlobal('DedicatedWorkerGlobalScope', class {});
		vi.stubGlobal('self', scope);
		vi.resetModules();

		await import('../../src/workers/persistWorker.js');

		expect(scope.onmessage).toBeUndefined();
	});

	it('answers messages through postMessage inside a dedicated worker scope', async () => {
		class FakeDedicatedWorkerGlobalScope {}
		const scope = new FakeDedicatedWorkerGlobalScope();
		const posted = new Promise(resolve => { scope.postMessage = resolve; });
		vi.stubGlobal('DedicatedWorkerGlobalScope', FakeDedicatedWorkerGlobalScope);
		vi.stubGlobal('self', scope);
		vi.resetModules();

		await import('../../src/workers/persistWorker.js');
		// An event without data is handled as an empty request, not a crash.
		scope.onmessage({});

		await expect(posted).resolves.toEqual({
			id: undefined,
			ok: false,
			error: { name: 'Error', message: 'Unknown persist op: undefined' },
		});
	});
});
