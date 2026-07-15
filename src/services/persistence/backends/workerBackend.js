/**
 * CHIVE persistence worker backend (main-thread host side).
 *
 * Implements the `{ available, hydrate, persist, exportBytes, importBytes, clear }` backend seam by
 * delegating to a long-lived persistence Worker (`workers/persistWorker.js`),
 * which runs `createBlobBackend()` off the main thread. This module must NOT
 * statically import `blobBackend`/sqlite, that would pull SQLite-WASM back onto
 * the main bundle and defeat the point. The main-thread fallback backend is
 * obtained lazily via dynamic `import()` only when a worker failure forces it.
 *
 * Two correctness rules drive the shape here (see the persistence plan):
 *   1. Materialize synchronously. `persist()` captures a self-contained op
 *      record (stripped metadata clone + payload refs) BEFORE any await, so a
 *      later fallback / resync never re-reads a live, possibly-moved snapshot.
 *   2. Reference-identity dedup. A dataset's `rows` / a chart's snapshot is
 *      re-sent only when its array reference changed since the last save to the
 *      CURRENT worker (sound because those payloads are immutable per id).
 *
 * Resilience: a generous watchdog plus a fallback on every worker termination
 * (sync spawn/post throw, async onerror, post-success crash, or timeout) so the
 * latest edit is always written somewhere, never silently lost.
 *
 * @typedef {import('../../../types.js').AppState} AppState
 * @typedef {import('../../../types.js').PersistWorkerRequest} PersistWorkerRequest
 * @typedef {import('../../../types.js').PersistWorkerResponse} PersistWorkerResponse
 */

const DEFAULT_TIMEOUT_MS = 120000;

let testWorkerFactory = null;

/**
 * Test seam, replace the persist-worker constructor for the default singleton.
 * Pass `null` to restore the real spawner. Isolated instances should instead
 * pass `workerFactory` to {@link createWorkerBackend} directly.
 *
 * @internal
 * @param {(() => Worker) | null} factory
 */
export function __setPersistWorkerFactoryForTesting(factory) {
	testWorkerFactory = factory;
}

function defaultWorkerFactory() {
	if (testWorkerFactory) return testWorkerFactory();
	return new Worker(
		new URL('../../../workers/persistWorker.js', import.meta.url),
		{ type: 'module' },
	);
}

function safeStructuredClone(value) {
	return typeof globalThis.structuredClone === 'function'
		? globalThis.structuredClone(value)
		: JSON.parse(JSON.stringify(value));
}

function cloneBytes(bytes) {
	if (ArrayBuffer.isView(bytes)) {
		return new Uint8Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
	}
	if (Object.prototype.toString.call(bytes) === '[object ArrayBuffer]') {
		return new Uint8Array(bytes.slice(0));
	}
	return bytes;
}

/**
 * Rebuild a real `Error` from a worker's `{ name, message }` envelope so
 * `isQuotaError` (which keys off `error.name`) still classifies quota failures.
 *
 * @param {{ name?: string, message?: string } | * } errLike
 * @returns {Error}
 */
function errorFromWorker(errLike) {
	if (errLike instanceof Error) return errLike;
	const error = new Error(String(errLike?.message || 'persistence worker error'));
	if (errLike?.name) error.name = errLike.name;
	return error;
}

const datasetKey = id => `dataset:${id}`;
const chartDataKey = id => `chart:${id}:data`;
const chartColsKey = id => `chart:${id}:cols`;

/**
 * @param {Object} [options]
 * @param {() => Worker} [options.workerFactory] - Spawns the persist worker (tests inject a mock).
 * @param {() => { persist: Function, hydrate: Function, clear: Function, exportBytes?: Function, importBytes?: Function }} [options.fallbackBackendFactory] - Main-thread fallback (tests inject a unique blobBackend).
 * @param {number} [options.timeoutMs] - Watchdog timeout. Generous by default so a big first save on a slow device does not false-trip.
 * @returns {{ available: () => boolean, hydrate: () => Promise<*>, persist: (snapshot: Partial<AppState>) => Promise<void>, exportBytes: (snapshot: Partial<AppState>, options?: { workOnly?: boolean }) => Promise<Uint8Array>, importBytes: (bytes: Uint8Array | ArrayBuffer) => Promise<*>, clear: () => Promise<void> }}
 */
export function createWorkerBackend({ workerFactory, fallbackBackendFactory, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
	const spawn = workerFactory || defaultWorkerFactory;

	let worker = null;
	let currentGeneration = 0;
	let workerProven = false;      // has the worker ever returned a response?
	let workerDisabled = false;    // startup failure → fall back for the session
	let nextId = 1;

	/** @type {Map<number, { id: number, record: Object, gen: number, resolve: Function, reject: Function, timer: *, retried: boolean, includedKeys: Set<string> }>} */
	const pending = new Map();      // insertion order = original send order (load-bearing for the drain)
	let drainPromise = null;        // non-null while a fallback drain is in progress

	/** @type {Map<string, Array<Object>>} payload key -> last-sent array ref, for the CURRENT worker instance */
	const sentPayloads = new Map();

	let fallbackBackend = null;

	async function getFallbackBackend() {
		if (!fallbackBackend) {
			if (fallbackBackendFactory) {
				fallbackBackend = fallbackBackendFactory();
			} else {
				const mod = await import('./blobBackend.js');
				fallbackBackend = mod.blobBackend;
			}
		}
		return fallbackBackend;
	}

	// ─── Synchronous op-record capture ──────────────────────────────────────

	/**
	 * Capture a self-contained persist record synchronously: a stripped (no
	 * payloads) `structuredClone` of the metadata envelope, plus every payload
	 * by reference, plus the set of present keys. The cached/included split is
	 * NOT frozen here, it is computed at post time against the live
	 * `sentPayloads` (so an op deferred behind a drain re-evaluates correctly).
	 *
	 * @param {Partial<AppState>} snapshot - Live-reference snapshot (getPersistenceSnapshot()).
	 * @returns {{ op: 'persist', meta: Object, refByKey: Map<string, Array<Object>>, presentKeys: Set<string> }}
	 */
	function capturePersistRecord(snapshot) {
		const refByKey = new Map();
		const presentKeys = new Set();

		const srcDatasets = Array.isArray(snapshot?.data?.datasets) ? snapshot.data.datasets : [];
		const metaDatasets = srcDatasets.map(ds => {
			const { rows, ...rest } = ds;
			if (ds.id) {
				const key = datasetKey(ds.id);
				presentKeys.add(key);
				refByKey.set(key, Array.isArray(rows) ? rows : []);
			}
			return rest; // metadata only, no rows
		});

		const srcPanel = snapshot?.panel && typeof snapshot.panel === 'object' ? snapshot.panel : null;
		let metaPanel = null;
		if (srcPanel) {
			const srcCharts = Array.isArray(srcPanel.charts) ? srcPanel.charts : [];
			const metaCharts = srcCharts.map(chart => {
				const { dataSnapshot, columnsSnapshot, ...rest } = chart;
				const cid = Number(chart?.id);
				if (Number.isInteger(cid)) {
					const dKey = chartDataKey(cid);
					const cKey = chartColsKey(cid);
					presentKeys.add(dKey);
					presentKeys.add(cKey);
					refByKey.set(dKey, Array.isArray(dataSnapshot) ? dataSnapshot : []);
					refByKey.set(cKey, Array.isArray(columnsSnapshot) ? columnsSnapshot : []);
				}
				return rest; // metadata only, no snapshots
			});
			metaPanel = { ...srcPanel, charts: metaCharts };
		}

		// Strip-then-clone: the envelope already has payloads removed, so this
		// clone is O(metadata), never O(rows). Cloning `panel` wholesale here
		// would pull the snapshot arrays back in and reintroduce the jank.
		const meta = safeStructuredClone({
			data: {
				datasets: metaDatasets,
				activeIndex: snapshot?.data?.activeIndex ?? -1,
			},
			panel: metaPanel,
			ui: snapshot?.ui,
		});

		return { op: 'persist', meta, refByKey, presentKeys };
	}

	function captureExportRecord(snapshot, { workOnly = false } = {}) {
		return {
			...capturePersistRecord(snapshot),
			op: 'export',
			workOnly: Boolean(workOnly),
		};
	}

	/**
	 * Build the persist message from a record, deciding cached-vs-included per
	 * payload against the live `sentPayloads`. Returns the message and the set
	 * of keys whose payload was included (used to update `sentPayloads` on ack).
	 *
	 * @param {Object} record
	 * @param {number} id
	 * @param {boolean} forceFull - When true, include every payload (no `*Cached`).
	 * @returns {{ message: PersistWorkerRequest, includedKeys: Set<string> }}
	 */
	function buildPersistMessage(record, id, forceFull) {
		const includedKeys = new Set();
		const meta = record.meta;

		const datasets = (meta.data?.datasets || []).map(ds => {
			const key = datasetKey(ds.id);
			const ref = record.refByKey.get(key);
			if (!forceFull && sentPayloads.get(key) === ref) {
				return { ...ds, rowsCached: true };
			}
			includedKeys.add(key);
			return { ...ds, rows: ref || [] };
		});

		let panel = meta.panel;
		if (panel) {
			const charts = (panel.charts || []).map(chart => {
				const cid = Number(chart.id);
				const out = { ...chart };
				const dKey = chartDataKey(cid);
				const cKey = chartColsKey(cid);
				const dRef = record.refByKey.get(dKey);
				const cRef = record.refByKey.get(cKey);
				if (!forceFull && sentPayloads.get(dKey) === dRef) {
					out.dataSnapshotCached = true;
				} else {
					includedKeys.add(dKey);
					out.dataSnapshot = dRef || [];
				}
				if (!forceFull && sentPayloads.get(cKey) === cRef) {
					out.columnsSnapshotCached = true;
				} else {
					includedKeys.add(cKey);
					out.columnsSnapshot = cRef || [];
				}
				return out;
			});
			panel = { ...panel, charts };
		}

		const message = {
			id,
			op: 'persist',
			snapshot: { ...meta, data: { ...meta.data, datasets }, panel },
		};
		return { message, includedKeys };
	}

	/**
	 * Rebuild the FULL snapshot (all payloads dereferenced) for a fallback
	 * persist. Driven by the record, never a live re-read.
	 *
	 * @param {Object} record
	 * @returns {Object}
	 */
	function rebuildFull(record) {
		const meta = record.meta;
		const datasets = (meta.data?.datasets || []).map(ds => ({
			...ds,
			rows: record.refByKey.get(datasetKey(ds.id)) || [],
		}));
		let panel = meta.panel;
		if (panel) {
			const charts = (panel.charts || []).map(chart => {
				const cid = Number(chart.id);
				return {
					...chart,
					dataSnapshot: record.refByKey.get(chartDataKey(cid)) || [],
					columnsSnapshot: record.refByKey.get(chartColsKey(cid)) || [],
				};
			});
			panel = { ...panel, charts };
		}
		return { ...meta, data: { ...meta.data, datasets }, panel };
	}

	function buildExportMessage(record, id) {
		return {
			id,
			op: 'export',
			snapshot: rebuildFull(record),
			workOnly: Boolean(record.workOnly),
		};
	}

	// ─── sentPayloads bookkeeping ───────────────────────────────────────────

	/**
	 * After an ok ack, set the included keys to their refs and prune any key
	 * whose id is absent from this op's present set (mirrors the worker dropping
	 * removed datasets/charts from its cache). Cached keys were already correct.
	 *
	 * @param {Object} record
	 * @param {Set<string>} includedKeys
	 */
	function commitSentPayloads(record, includedKeys) {
		for (const key of includedKeys) sentPayloads.set(key, record.refByKey.get(key));
		for (const key of [...sentPayloads.keys()]) {
			if (!record.presentKeys.has(key)) sentPayloads.delete(key);
		}
	}

	// ─── Worker lifecycle ───────────────────────────────────────────────────

	function ensureWorker() {
		if (worker) return;
		const w = spawn();
		const gen = currentGeneration;
		w.onmessage = event => handleWorkerMessage(gen, event);
		w.onerror = event => onWorkerError(gen, event);
		worker = w;
	}

	function clearEntry(entry) {
		if (entry.timer) {
			clearTimeout(entry.timer);
			entry.timer = null;
		}
		pending.delete(entry.id);
	}

	function handleWorkerMessage(gen, event) {
		if (gen !== currentGeneration) return;          // stale worker, ignore
		const msg = event?.data || {};
		const entry = pending.get(msg.id);
		if (!entry) return;                             // already settled / unknown id

		workerProven = true;                            // a response means the worker booted and ran

		if (msg.ok) {
			clearEntry(entry);
			if (entry.record.op === 'persist') {
				commitSentPayloads(entry.record, entry.includedKeys);
			} else if (entry.record.op === 'clear') {
				sentPayloads.clear();
			}
			entry.resolve(['hydrate', 'export', 'import'].includes(entry.record.op) ? (msg.result ?? null) : undefined);
			return;
		}

		if (msg.needsResync) {
			handleNeedsResync(entry);
			return;
		}

		// Structured error (e.g. quota): the worker is alive, the op failed.
		clearEntry(entry);
		entry.reject(errorFromWorker(msg.error));
	}

	/**
	 * A payload was flagged cached but missing from the worker cache. Clear the
	 * host cache and retry ONCE with full payloads (rebuilt from the record, not
	 * live state). A second `needsResync` fails the op (no infinite loop).
	 *
	 * @param {Object} entry
	 */
	function handleNeedsResync(entry) {
		if (entry.record.op !== 'persist') {
			clearEntry(entry);
			entry.reject(new Error('persistence cache resync requested for non-persist op'));
			return;
		}
		sentPayloads.clear();
		if (entry.retried) {
			clearEntry(entry);
			entry.reject(new Error('persistence cache resync failed'));
			return;
		}
		entry.retried = true;
		if (entry.timer) clearTimeout(entry.timer);
		const { message, includedKeys } = buildPersistMessage(entry.record, entry.id, true);
		entry.includedKeys = includedKeys;             // full retry includes every present key
		entry.timer = setTimeout(() => onWatchdog(entry.id, entry.gen), timeoutMs);
		try {
			worker.postMessage(message);
		} catch {
			// Keep the entry pending so the reset drains it via the fallback.
			resetAndDrain(entry.gen, !workerProven);
		}
	}

	function onWatchdog(id, gen) {
		if (gen !== currentGeneration) return;
		if (!pending.has(id)) return;
		resetAndDrain(gen, false);                      // a timeout never disables (may just be slow)
	}

	function onWorkerError(gen, event) {
		if (gen !== currentGeneration) return;
		if (event && typeof event.preventDefault === 'function') event.preventDefault();
		// A worker error is otherwise invisible: the fallback rescues the write so
		// no user-facing error fires. Log it like the other persist failures, and
		// capture the full ErrorEvent (error/stack + filename/lineno/colno) so a
		// worker-only failure mode stays debuggable.
		console.warn('[chive:persist] worker error; falling back to main thread:', {
			error: event?.error,
			message: event?.message,
			filename: event?.filename,
			lineno: event?.lineno,
			colno: event?.colno,
		});
		resetAndDrain(gen, !workerProven);              // startup onerror disables; post-success only resets
	}

	/**
	 * Atomically tear down the current worker and drain every pending op through
	 * the fallback, serially and in original send order. Generation-scoped and
	 * idempotent: a watchdog and an onerror for the same dead generation drain
	 * once.
	 *
	 * @param {number} gen
	 * @param {boolean} disable - Disable worker mode for the session (startup failure).
	 * @returns {Promise<void>}
	 */
	function resetAndDrain(gen, disable) {
		if (gen !== currentGeneration) return drainPromise || Promise.resolve();

		// Snapshot pending FIRST (in insertion order) before clearing, else the
		// records needed for fallback are lost.
		const toDrain = [...pending.values()];
		for (const entry of toDrain) {
			if (entry.timer) clearTimeout(entry.timer);
		}
		pending.clear();
		currentGeneration += 1;
		if (worker) {
			worker.onmessage = null;
			worker.onerror = null;
			try { worker.terminate(); } catch { /* ignore */ }
			worker = null;
		}
		if (disable) workerDisabled = true;
		// Reset = resync: a fresh worker spawns with empty caches, so the next
		// save must send full payloads. The fallback never touches sentPayloads.
		sentPayloads.clear();

		drainPromise = (async () => {
			// Serial by design: ops must settle in original send order (a fallback
			// persist must land before a following clear, etc.).
			for (const entry of toDrain) {
				await runEntryOnFallback(entry);          // settles each op; continues past per-op failures
			}
		})().finally(() => { drainPromise = null; });
		return drainPromise;
	}

	/**
	 * Run one op on the main-thread fallback and settle its original promise.
	 * Never throws (a per-op failure rejects only that op so the drain
	 * continues).
	 *
	 * @param {{ record: Object, resolve: Function, reject: Function }} entry
	 */
	async function runEntryOnFallback(entry) {
		try {
			const op = entry.record.op;
			const stable = op === 'persist' || op === 'export'
				? safeStructuredClone(rebuildFull(entry.record))
				: null;
			const fb = await getFallbackBackend();
			if (op === 'persist') {
				await fb.persist(stable);
				entry.resolve(undefined);
			} else if (op === 'hydrate') {
				const result = await fb.hydrate();
				entry.resolve(result ?? null);
			} else if (op === 'export') {
				const result = await fb.exportBytes(stable, { workOnly: Boolean(entry.record.workOnly) });
				entry.resolve(result);
			} else if (op === 'import') {
				const result = await fb.importBytes(entry.record.bytes);
				entry.resolve(result);
			} else if (op === 'clear') {
				await fb.clear();
				entry.resolve(undefined);
			} else {
				entry.resolve(undefined);
			}
		} catch (err) {
			entry.reject(errorFromWorker(err));
		}
	}

	// ─── Op dispatch ────────────────────────────────────────────────────────

	/**
	 * @param {{ op: 'persist' | 'hydrate' | 'export' | 'import' | 'clear', [k: string]: * }} record
	 * @returns {Promise<*>}
	 */
	function runOp(record) {
		// A new op during a drain captures its record synchronously (already done
		// by the caller) but defers EXECUTION behind the drain so a fallback write
		// and a fresh-worker write never race on the same IndexedDB blob.
		if (drainPromise) {
			return drainPromise.then(() => runOp(record));
		}
		if (workerDisabled) {
			return new Promise((resolve, reject) => {
				runEntryOnFallback({ record, resolve, reject });
			});
		}

		return new Promise((resolve, reject) => {
			const entry = { id: nextId++, record, gen: currentGeneration, resolve, reject, timer: null, retried: false, includedKeys: null };

			try {
				ensureWorker();                           // sync `new Worker()` may throw
				entry.gen = currentGeneration;
			} catch {
				// Startup spawn failure: complete this op on the fallback and disable
				// the (unproven) worker for the session.
				if (!workerProven) workerDisabled = true;
				runEntryOnFallback(entry);
				return;
			}

			// Register + arm BEFORE posting so a worker that replies synchronously
			// (e.g. a test mock) still finds a pending entry.
			pending.set(entry.id, entry);
			entry.timer = setTimeout(() => onWatchdog(entry.id, entry.gen), timeoutMs);

			let message;
			if (record.op === 'persist') {
				const built = buildPersistMessage(record, entry.id, false);
				message = built.message;
				entry.includedKeys = built.includedKeys;
			} else if (record.op === 'export') {
				message = buildExportMessage(record, entry.id);
			} else if (record.op === 'import') {
				message = { id: entry.id, op: 'import', bytes: record.bytes };
			} else {
				message = { id: entry.id, op: record.op };
			}

			try {
				worker.postMessage(message);              // structured clone captures the included payloads HERE
			} catch {
				// Sync postMessage throw: the entry is pending, so the reset drains it
				// via the fallback (settling this op's original promise).
				resetAndDrain(entry.gen, !workerProven);
			}
		});
	}

	// ─── Backend seam ───────────────────────────────────────────────────────

	function available() {
		return typeof indexedDB !== 'undefined';
	}

	function hydrate() {
		if (!available()) return Promise.resolve(null);
		return runOp({ op: 'hydrate' });
	}

	function persist(snapshot) {
		const record = capturePersistRecord(snapshot);  // synchronous materialization, always first
		return runOp(record);
	}

	function exportBytes(snapshot, options = {}) {
		const record = captureExportRecord(snapshot, options);
		return runOp(record);
	}

	function importBytes(bytes) {
		return runOp({ op: 'import', bytes: cloneBytes(bytes) });
	}

	function clear() {
		return runOp({ op: 'clear' });
	}

	return { available, hydrate, persist, exportBytes, importBytes, clear };
}

export const workerBackend = createWorkerBackend();
