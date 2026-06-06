/**
 * CHIVE Persistence Worker.
 *
 * Runs the SQLite lifecycle (persist + hydrate + clear + fingerprint + export
 * + IndexedDB write) off the main thread so a large auto-save no longer freezes
 * the tab. The heavy `createBlobBackend()` (vendored SQLite-WASM) runs verbatim
 * here, so importing this module pulls sqlite into the WORKER chunk, not the
 * main bundle.
 *
 * Two responsibilities beyond delegating to the backend:
 *   1. Serialize ops so a `clear` can never interleave with an in-flight
 *      `persist`/`hydrate` (one internal promise chain that never stays
 *      rejected, so one failed op cannot wedge the queue).
 *   2. Own the row + snapshot payload caches. The host omits unchanged dataset
 *      rows / chart snapshots from the message (flagged `*Cached`); this worker
 *      refills them from cache. Cache writes are STAGED and committed only after
 *      `backend.persist` succeeds, keeping the worker cache aligned with the
 *      host's `sentPayloads` (which also updates only after the ok ack).
 *
 * Message protocol, see `services/persistence/workerBackend.js` for the host
 * side and the {@link PersistWorkerRequest} / {@link PersistWorkerResponse}
 * typedefs in `src/types.js`.
 *
 * @typedef {import('../types.js').PersistWorkerRequest} PersistWorkerRequest
 * @typedef {import('../types.js').PersistWorkerResponse} PersistWorkerResponse
 */

import { createBlobBackend } from '../services/persistence/blobBackend.js';

/**
 * Replace a Map's contents with another Map's entries, in place.
 *
 * @param {Map} target
 * @param {Map} next
 */
function replaceMap(target, next) {
	target.clear();
	for (const [key, value] of next) target.set(key, value);
}

/**
 * Build the handler that owns the payload caches and the serialized op chain.
 * Exported so tests can drive the cache / staged-commit / needsResync / chain-
 * recovery logic directly with a synthetic `post` and a real
 * `createBlobBackend`, without spawning a Worker.
 *
 * @param {{ persist: Function, hydrate: Function, clear: Function }} backend - A `createBlobBackend()` instance.
 * @param {(msg: PersistWorkerResponse) => void} post - Outgoing-message sink (`self.postMessage` in a worker; a spy in tests).
 * @returns {{ handleMessage: (msg: PersistWorkerRequest) => Promise<void>, rowsCache: Map, snapshotCache: Map }}
 */
export function createPersistHandler(backend, post) {
	/** @type {Map<string, Array<Object>>} datasetId -> rows */
	const rowsCache = new Map();
	/** @type {Map<number, { data: Array<Object>, cols: Array<Object> }>} chartId -> snapshot payloads */
	const snapshotCache = new Map();

	// Serialize ops. Each link RESOLVES even on failure (handleOne catches and
	// posts an {ok:false} envelope) so a failed op never wedges later messages.
	let chain = Promise.resolve();

	/**
	 * Reconstruct the full snapshot for `backend.persist` and compute the next
	 * cache state, WITHOUT mutating the live caches. Returns `{ needsResync }`
	 * when a payload is flagged cached but missing from cache.
	 *
	 * @param {Object} snapshot
	 * @returns {{ full: Object, nextRows: Map, nextSnapshot: Map } | { needsResync: true }}
	 */
	function reconstructPersist(snapshot) {
		const nextRows = new Map();
		const nextSnapshot = new Map();

		const srcDatasets = Array.isArray(snapshot?.data?.datasets) ? snapshot.data.datasets : [];
		const fullDatasets = [];
		for (const ds of srcDatasets) {
			let rows;
			if (ds.rowsCached) {
				if (!rowsCache.has(ds.id)) return { needsResync: true };
				rows = rowsCache.get(ds.id);
			} else {
				rows = Array.isArray(ds.rows) ? ds.rows : [];
			}
			const { rowsCached: _rowsCached, ...rest } = ds;
			rest.rows = rows;
			fullDatasets.push(rest);
			if (ds.id) nextRows.set(ds.id, rows);
		}

		const srcPanel = snapshot?.panel && typeof snapshot.panel === 'object' ? snapshot.panel : null;
		let fullPanel = srcPanel;
		if (srcPanel) {
			const srcCharts = Array.isArray(srcPanel.charts) ? srcPanel.charts : [];
			const fullCharts = [];
			for (const chart of srcCharts) {
				const chartId = Number(chart?.id);
				const cached = snapshotCache.get(chartId);
				let data;
				let cols;
				if (chart.dataSnapshotCached) {
					if (!cached) return { needsResync: true };
					data = cached.data;
				} else {
					data = Array.isArray(chart.dataSnapshot) ? chart.dataSnapshot : [];
				}
				if (chart.columnsSnapshotCached) {
					if (!cached) return { needsResync: true };
					cols = cached.cols;
				} else {
					cols = Array.isArray(chart.columnsSnapshot) ? chart.columnsSnapshot : [];
				}
				const { dataSnapshotCached: _dataCached, columnsSnapshotCached: _colsCached, ...rest } = chart;
				rest.dataSnapshot = data;
				rest.columnsSnapshot = cols;
				fullCharts.push(rest);
				if (Number.isInteger(chartId)) nextSnapshot.set(chartId, { data, cols });
			}
			fullPanel = { ...srcPanel, charts: fullCharts };
		}

		const full = {
			...snapshot,
			data: { ...snapshot.data, datasets: fullDatasets },
			panel: fullPanel,
		};
		return { full, nextRows, nextSnapshot };
	}

	/**
	 * Run a single op and post its response. Always resolves (errors are posted
	 * as {ok:false} envelopes, never thrown) so the serialized chain survives.
	 *
	 * @param {PersistWorkerRequest} msg
	 */
	async function handleOne(msg) {
		const { id, op } = msg || {};
		try {
			if (op === 'persist') {
				const recon = reconstructPersist(msg.snapshot);
				if (recon.needsResync) {
					post({ id, ok: false, needsResync: true });
					return;
				}
				await backend.persist(recon.full);
				// Staged commit: only swap caches in after the write succeeds.
				replaceMap(rowsCache, recon.nextRows);
				replaceMap(snapshotCache, recon.nextSnapshot);
				post({ id, ok: true, result: null });
				return;
			}
			if (op === 'hydrate') {
				const result = await backend.hydrate();
				post({ id, ok: true, result: result ?? null });
				return;
			}
			if (op === 'clear') {
				await backend.clear();
				rowsCache.clear();
				snapshotCache.clear();
				post({ id, ok: true, result: null });
				return;
			}
			post({ id, ok: false, error: { name: 'Error', message: `Unknown persist op: ${op}` } });
		} catch (err) {
			post({
				id,
				ok: false,
				error: { name: err?.name || 'Error', message: err?.message || 'persist worker error' },
			});
		}
	}

	function handleMessage(msg) {
		const run = chain.then(() => handleOne(msg));
		// Swallow on the stored chain so a rejection (should not happen, handleOne
		// catches) cannot wedge later ops; return the real run to callers/tests.
		chain = run.catch(() => {});
		return run;
	}

	return { handleMessage, rowsCache, snapshotCache };
}

// WHY: guarded by `DedicatedWorkerGlobalScope` so this module can be imported as
// a regular ES module by tests (jsdom is not a worker context) without spinning
// up the real backend wiring or registering a global onmessage handler. Mirrors
// the guard in dataIngestWorker.js.
if (typeof DedicatedWorkerGlobalScope !== 'undefined' && self instanceof DedicatedWorkerGlobalScope) {
	const backend = createBlobBackend();
	const handler = createPersistHandler(backend, msg => self.postMessage(msg));
	self.onmessage = event => {
		handler.handleMessage(event.data || {});
	};
}
