import { __setIngestWorkerFactoryForTesting } from '../../src/services/dataIngestService.js';
import { runIngest } from '../../src/workers/dataIngestWorker.js';

/**
 * Run the data worker in-process: each request goes through the real Ingest
 * pipeline on a microtask instead of a worker thread, and a `continue`
 * message resumes a request waiting after its row count. Call
 * {@link restoreIngestWorker} in `afterEach`.
 *
 * @returns {Object[]} The requests the workers received, in order. `continue` messages are not listed; the array's `workers` property counts the workers spawned.
 */
export function useInProcessIngestWorker() {
	const requests = [];
	let workers = 0;
	// Not enumerable, so `toEqual([])` still compares only the requests.
	Object.defineProperty(requests, 'workers', { get: () => workers });
	__setIngestWorkerFactoryForTesting(() => {
		workers += 1;
		let resume = null;
		return {
			postMessage(message) {
				if (message?.type === 'continue') {
					const next = resume;
					resume = null;
					next?.();
					return;
				}
				requests.push(message);
				queueMicrotask(() => runIngest(
					message,
					reply => this.onmessage?.({ data: reply }),
					() => new Promise(resolve => { resume = resolve; }),
				));
			},
			terminate() {},
		};
	});
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
