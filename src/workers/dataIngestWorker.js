/**
 * CHIVE Data Ingest Worker.
 *
 * Runs dataset ingest ({@link ingestDataset}) off the main thread and relays
 * its progress stages as messages so the host can drive a corner-toast
 * progress bar. The pipeline itself lives in `domain/datasets/ingest.js`.
 *
 * Message protocol, see `services/dataIngestService.js` for the host side
 * and the {@link IngestWorkerRequest} / {@link IngestWorkerResponse}
 * typedefs in `src/types.js`.
 *
 * @typedef {import('../types.js').IngestWorkerRequest} IngestWorkerRequest
 * @typedef {import('../types.js').IngestWorkerResponse} IngestWorkerResponse
 */

import { completeIngest, prepareIngest } from '../domain/datasets/ingest.js';

/**
 * Ingest one request, posting a `progress` message per stage, then `done`
 * with the result or `error` with the parser's or the join's stable `reason`.
 * The onmessage wrapper still catches genuinely-unexpected throws.
 *
 * A request with `options.awaitRowCount` stops after parsing: the worker
 * posts a `row-count` message with the row and column counts and waits for
 * `continueIngest` before any per-column work. The host declines by
 * terminating the worker. Without that option, every message is posted
 * before the returned promise settles, synchronously.
 *
 * Exported so tests can run it as an in-process worker with a synthetic
 * `post` function.
 *
 * @param {IngestWorkerRequest} payload - Inbound request body.
 * @param {(msg: IngestWorkerResponse) => void} post - Sink for outgoing messages (`self.postMessage` in worker context, a mock in tests).
 * @param {() => Promise<void>} [continueIngest] - Settles when the host answers a `row-count` message with `continue`.
 * @returns {Promise<void>}
 */
export async function runIngest({ id, ...request }, post, continueIngest = () => Promise.resolve()) {
	const config = {
		onProgress: ({ stage, percent }) => post({ id, type: 'progress', stage, percent }),
	};
	const prepared = prepareIngest(request, config);
	if (!prepared.ok) {
		post({ id, type: 'error', reason: prepared.reason });
		return;
	}
	if (request.options?.awaitRowCount) {
		const { rowCount, columnCount } = prepared.value;
		post({ id, type: 'row-count', rowCount, columnCount });
		await continueIngest();
	}
	const result = completeIngest(prepared.value, config);
	if (result.ok) post({ id, type: 'done', result: result.value });
	else post({ id, type: 'error', reason: result.reason });
}

// WHY: guarded by `DedicatedWorkerGlobalScope` so this module can be imported as
// a regular ES module by tests (jsdom is not a worker context) without registering
// a global onmessage handler. Without the guard the import would have side effects
// that break tests.
if (typeof DedicatedWorkerGlobalScope !== 'undefined' && self instanceof DedicatedWorkerGlobalScope) {
	// Each worker runs one request, so at most one ingest waits for `continue`.
	let pending = null;
	self.onmessage = (event) => {
		const data = event.data || {};
		if (data.type === 'continue') {
			if (pending && pending.id === data.id) {
				const { resume } = pending;
				pending = null;
				resume();
			}
			return;
		}
		const post = (msg) => self.postMessage(msg);
		const continueIngest = () => new Promise(resume => { pending = { id: data.id, resume }; });
		runIngest(data, post, continueIngest).catch(err => {
			self.postMessage({ id: data.id, type: 'error', message: err?.message || 'unknown-error' });
		});
	};
}
