/**
 * CHIVE Data Ingest Worker.
 *
 * Runs parse + type detection + numeric normalization + stats off the main
 * thread so a 200k-row upload no longer freezes the tab. Posts progress
 * messages between stages so the host can drive a corner-toast progress bar.
 *
 * Pure logic comes from `domain/datasets/` (no DOM deps). The
 * row-normalization loop is duplicated here as {@link chunkedNormalize} so
 * it can yield progress between batches; the canonical sync `processData`
 * in `domain/datasets/processData.js` stays untouched (still used by the join
 * builder + tests).
 *
 * Message protocol, see `services/dataIngestService.js` for the host side
 * and the {@link IngestWorkerRequest} / {@link IngestWorkerResponse}
 * typedefs in `src/types.js`.
 *
 * @typedef {import('../types.js').ColumnSpec} ColumnSpec
 * @typedef {import('../types.js').IngestWorkerRequest} IngestWorkerRequest
 * @typedef {import('../types.js').IngestWorkerResponse} IngestWorkerResponse
 * @typedef {import('../types.js').IngestWorkerDoneResult} IngestWorkerDoneResult
 */

import { parseCsv, parseJson } from '../domain/datasets/parse.js';
import { detectDecimalSeparator, detectType, normalizeNumericString } from '../domain/datasets/typeDetection.js';
import { calculateStatistics, calculateCategoricalStatistics } from '../domain/datasets/statistics.js';
import { DECIMAL_DETECTION, COLUMN_TYPES } from '../config/columnTypeDetection.js';

const NORMALIZE_CHUNK_SIZE = 20000;

/**
 * Convert raw rows to typed rows in chunks, invoking `onChunk(done, total)`
 * between each chunk so callers can post progress messages.
 *
 * Exported so tests can exercise the loop without spawning a real Worker.
 *
 * @param {Array<Object<string, *>>} rawData
 * @param {ColumnSpec[]} columns
 * @param {string} decimalSeparator - `'.'` or `','`.
 * @param {((done: number, total: number) => void) | null | undefined} onChunk
 * @param {number} [chunkSize=20000]
 * @returns {Array<Object<string, *>>}
 */
export function chunkedNormalize(rawData, columns, decimalSeparator, onChunk, chunkSize = NORMALIZE_CHUNK_SIZE) {
	const out = new Array(rawData.length);

	for (let i = 0; i < rawData.length; i += chunkSize) {
		const end = Math.min(i + chunkSize, rawData.length);
		for (let j = i; j < end; j++) {
			const row = rawData[j];
			const converted = {};
			for (const { name, type } of columns) {
				const value = row[name];
				if (type === COLUMN_TYPES.NUMBER && value !== '' && value !== null && value !== undefined) {
					converted[name] = Number(normalizeNumericString(String(value), decimalSeparator));
				} else if (type === COLUMN_TYPES.DATE && value !== '' && value !== null && value !== undefined) {
					const parsed = value instanceof Date ? value : new Date(value);
					converted[name] = Number.isFinite(parsed?.getTime?.()) ? parsed : null;
				} else {
					converted[name] = value;
				}
			}
			out[j] = converted;
		}
		if (onChunk) onChunk(end, rawData.length);
	}

	return out;
}

/**
 * Run the full ingest pipeline. On a parse/empty-file failure, posts an
 * `error` message carrying the parser's stable `reason` code and returns;
 * the onmessage wrapper still catches genuinely-unexpected throws.
 *
 * Exported so tests can drive the pipeline directly with a synthetic
 * `post` function.
 *
 * @param {IngestWorkerRequest} payload - Inbound request body.
 * @param {(msg: IngestWorkerResponse) => void} post - Sink for outgoing messages (`self.postMessage` in worker context, a mock in tests).
 */
export function runIngest({ id, kind, text, options = {} }, post) {
	const rowLimit = Number.isFinite(options.rowLimit) ? options.rowLimit : Infinity;

	post({ id, type: 'progress', stage: 'parsing', percent: 0 });
	const parsed = kind === 'json' ? parseJson(text) : parseCsv(text);
	if (!parsed.ok) {
		post({ id, type: 'error', reason: parsed.reason });
		return;
	}
	let rawData = parsed.rows;
	post({ id, type: 'progress', stage: 'parsing', percent: 30 });

	// Drop unwanted columns before any per-column work (preset use case).
	if (Array.isArray(options.dropColumns) && options.dropColumns.length > 0) {
		const dropSet = new Set(options.dropColumns);
		rawData = rawData.map(row => {
			const next = {};
			for (const key of Object.keys(row)) {
				if (!dropSet.has(key)) next[key] = row[key];
			}
			return next;
		});
	}

	let truncatedFrom = null;
	if (rawData.length > rowLimit) {
		truncatedFrom = rawData.length;
		rawData = rawData.slice(0, rowLimit);
	}

	if (rawData.length === 0) {
		post({
			id,
			type: 'done',
			result: {
				rows: [],
				columns: [],
				decimalSeparator: '.',
				statsNumeric: [],
				statsCategorical: [],
				truncatedFrom,
			},
		});
		return;
	}

	post({ id, type: 'progress', stage: 'decimal-detection', percent: 32 });
	const allRawValues = rawData
		.slice(0, DECIMAL_DETECTION.sampleSize)
		.flatMap(row => Object.values(row))
		.map(v => String(v ?? '').trim())
		.filter(v => v.length > 0);
	const decimalSeparator = detectDecimalSeparator(allRawValues);
	post({ id, type: 'progress', stage: 'decimal-detection', percent: 35 });

	const columnNames = Object.keys(rawData[0]);
	const columns = [];
	for (let i = 0; i < columnNames.length; i++) {
		const name = columnNames[i];
		const values = rawData.map(row => row[name]);
		columns.push({ name: name, type: detectType(values, decimalSeparator) });
		const pct = 35 + Math.round(((i + 1) / columnNames.length) * 15);
		post({ id, type: 'progress', stage: 'type-detection', percent: pct });
	}

	const rows = chunkedNormalize(rawData, columns, decimalSeparator, (done, total) => {
		const pct = 50 + Math.round((done / total) * 40);
		post({ id, type: 'progress', stage: 'normalize', percent: pct });
	});

	post({ id, type: 'progress', stage: 'stats', percent: 92 });
	const statsNumeric = calculateStatistics(rows, columns);
	post({ id, type: 'progress', stage: 'stats', percent: 96 });
	const statsCategorical = calculateCategoricalStatistics(rows, columns);
	post({ id, type: 'progress', stage: 'stats', percent: 100 });

	post({
		id,
		type: 'done',
		result: { rows, columns, decimalSeparator, statsNumeric, statsCategorical, truncatedFrom },
	});
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
