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

import { ingestDataset } from '../domain/datasets/ingest.js';

/**
 * Ingest one request, posting a `progress` message per stage, then `done`
 * with the result or `error` with the parser's or the join's stable `reason`.
 * The onmessage wrapper still catches genuinely-unexpected throws.
 *
 * Exported so tests can run it as an in-process worker with a synthetic
 * `post` function.
 *
 * @param {IngestWorkerRequest} payload - Inbound request body.
 * @param {(msg: IngestWorkerResponse) => void} post - Sink for outgoing messages (`self.postMessage` in worker context, a mock in tests).
 */
export function runIngest({ id, ...request }, post) {
	const result = ingestDataset(request, {
		onProgress: ({ stage, percent }) => post({ id, type: 'progress', stage, percent }),
	});
	if (result.ok) post({ id, type: 'done', result: result.value });
	else post({ id, type: 'error', reason: result.reason });
}

// WHY: guarded by `DedicatedWorkerGlobalScope` so this module can be imported as
// a regular ES module by tests (jsdom is not a worker context) without registering
// a global onmessage handler. Without the guard the import would have side effects
// that break tests.
if (typeof DedicatedWorkerGlobalScope !== 'undefined' && self instanceof DedicatedWorkerGlobalScope) {
	self.onmessage = (event) => {
		const data = event.data || {};
		try {
			runIngest(data, (msg) => self.postMessage(msg));
		} catch (err) {
			self.postMessage({ id: data.id, type: 'error', message: err?.message || 'unknown-error' });
		}
	};
}
