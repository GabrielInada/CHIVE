/**
 * CHIVE sample dataset service.
 *
 * Fetches a sample dataset's `dataUrl` with a 10s timeout and a caller-supplied
 * AbortSignal so the user-cancel button can interrupt the fetch (not just the
 * downstream worker ingest).
 *
 * @typedef {import('../types.js').SampleDatasetDescriptor} SampleDatasetDescriptor
 * @typedef {import('../types.js').SampleDatasetSource} SampleDatasetSource
 * @typedef {import('../types.js').Result} Result
 */

import { ok, fail } from '../utils/result.js';

const SAMPLE_DATASET_FETCH_TIMEOUT_MS = 10000;

/**
 * Classify a fetch/body-read failure into a stable reason. A user-initiated
 * abort wins over the timeout (so cancel reads as `'cancelled'`, matching the
 * worker-ingest path); the composed timeout reads as `'sample-dataset-fetch-timeout'`;
 * anything else (a genuine network error) is `'sample-dataset-fetch-network'`.
 *
 * @private
 */
function fetchFailureReason(signal, timeoutSignal) {
	if (signal?.aborted) return 'cancelled';
	if (timeoutSignal.aborted) return 'sample-dataset-fetch-timeout';
	return 'sample-dataset-fetch-network';
}

/**
 * Fetch a sample dataset's `dataUrl` with a 10s timeout composed with the caller's
 * optional abort signal.
 *
 * Format detection prefers `sampleDataset.dataFormat` (case-insensitive) and
 * falls back to checking whether the URL ends with `.json`. Everything
 * else is treated as CSV.
 *
 * @param {SampleDatasetDescriptor} sampleDataset
 * @param {{ signal?: AbortSignal, timeoutMs?: number }} [options]
 * @returns {Promise<Result>} `ok({ value: SampleDatasetSource })` on success, or `fail(reason)` with one of:
 *   `'sample-dataset-data-missing'` (no usable `dataUrl`), `'cancelled'` (caller aborted),
 *   `'sample-dataset-fetch-timeout'` (no response within `timeoutMs`), `'sample-dataset-fetch-failed:<status>'`
 *   (non-2xx response), or `'sample-dataset-fetch-network'` (the fetch/body read failed otherwise).
 */
export async function loadSampleDatasetSource(sampleDataset, { signal, timeoutMs = SAMPLE_DATASET_FETCH_TIMEOUT_MS } = {}) {
	if (typeof sampleDataset?.dataUrl !== 'string' || !sampleDataset.dataUrl.trim()) {
		return fail('sample-dataset-data-missing');
	}

	const timeoutSignal = AbortSignal.timeout(timeoutMs);
	const combinedSignal = signal
		? AbortSignal.any([signal, timeoutSignal])
		: timeoutSignal;

	let response;
	try {
		response = await fetch(sampleDataset.dataUrl, { signal: combinedSignal });
	} catch {
		return fail(fetchFailureReason(signal, timeoutSignal));
	}

	if (!response.ok) {
		return fail(`sample-dataset-fetch-failed:${response.status}`);
	}

	let rawText;
	try {
		rawText = await response.text();
	} catch {
		return fail(fetchFailureReason(signal, timeoutSignal));
	}

	const format = String(sampleDataset.dataFormat || '').toLowerCase();
	const kind = format === 'json' || sampleDataset.dataUrl.toLowerCase().endsWith('.json') ? 'json' : 'csv';
	return ok({ value: { kind, text: rawText, dropColumns: sampleDataset.dropColumns || [] } });
}
