import { __setIngestWorkerFactoryForTesting } from '../../src/services/dataIngestService.js';
import { runIngest } from '../../src/workers/dataIngestWorker.js';

/**
 * Run the data worker in-process: each request goes through the real Ingest
 * pipeline on a microtask instead of a worker thread. Call
 * {@link restoreIngestWorker} in `afterEach`.
 *
 * @returns {Object[]} The requests the worker received, in order.
 */
export function useInProcessIngestWorker() {
	const requests = [];
	__setIngestWorkerFactoryForTesting(() => ({
		postMessage(request) {
			requests.push(request);
			queueMicrotask(() => runIngest(request, message => this.onmessage({ data: message })));
		},
		terminate() {},
	}));
	return requests;
}

/**
 * Give every request to a worker that never answers until the call is
 * cancelled, to test cancelling mid-ingest.
 *
 * @returns {Promise<void>} Resolves once the first request reaches the worker.
 */
export function useSilentIngestWorker() {
	let reached;
	const received = new Promise(resolve => { reached = resolve; });
	__setIngestWorkerFactoryForTesting(() => ({
		postMessage() { reached(); },
		terminate() {},
	}));
	return received;
}

export function restoreIngestWorker() {
	__setIngestWorkerFactoryForTesting(null);
}
