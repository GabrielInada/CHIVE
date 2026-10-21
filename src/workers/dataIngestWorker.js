/**
 * CHIVE Data Ingest Worker.
 *
 * Runs parse or dataset join + type detection + cell canonicalization + stats
 * off the main thread. Posts progress messages between stages so the host can
 * drive a corner-toast progress bar.
 *
 * Pure logic comes from `domain/datasets/` (no DOM deps). The
 * row-normalization loop is duplicated here as {@link chunkedNormalize} so
 * it can yield progress between batches; the canonical sync `processData`
 * in `domain/datasets/processData.js` stays available for small inline presets
 * and pure-domain tests.
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
import { joinDatasets } from '../domain/datasets/join.js';
import { detectDecimalSeparator, detectType } from '../domain/datasets/typeDetection.js';
import { toCanonicalCell } from '../domain/datasets/cellValues.js';
import { calculateStatistics, calculateCategoricalStatistics } from '../domain/datasets/statistics.js';
import { DECIMAL_DETECTION } from '../config/columnTypeDetection.js';

const NORMALIZE_CHUNK_SIZE = 20000;

/**
 * Convert raw rows to canonical rows in chunks, invoking
 * `onChunk(done, total)` between each chunk so callers can post progress
 * messages. Every output row has every column, each cell in its column type's
 * canonical form (see `toCanonicalCell`).
 *
 * Exported so tests can exercise the loop without spawning a real Worker.
 *
 * @param {Array<Object<string, *>>} rawData
 * @param {ColumnSpec[]} columns
 * @param {string} decimalSeparator - Fallback for columns without a saved separator: `'.'` or `','`.
 * @param {((done: number, total: number) => void) | null | undefined} onChunk
 * @param {number} [chunkSize=20000]
 * @returns {Array<Object<string, *>>}
 */
export function chunkedNormalize(rawData, columns, decimalSeparator, onChunk, chunkSize = NORMALIZE_CHUNK_SIZE) {
	const out = new Array(rawData.length);
	const cells = columns.map(({ name, type, decimalSeparator: columnSeparator = decimalSeparator }) => ({
		name,
		type,
		options: { decimalSeparator: columnSeparator },
	}));

	for (let i = 0; i < rawData.length; i += chunkSize) {
		const end = Math.min(i + chunkSize, rawData.length);
		for (let j = i; j < end; j++) {
			const row = rawData[j];
			const converted = {};
			for (const { name, type, options } of cells) {
				converted[name] = toCanonicalCell(row[name], type, options);
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
export function runIngest({ id, kind, text, join, options = {} }, post) {
	const rowLimit = Number.isFinite(options.rowLimit) ? options.rowLimit : Infinity;
	let rawData;
	let outputColumns = null;
	const inheritedSeparators = new Map();

	if (kind === 'join') {
		post({ id, type: 'progress', stage: 'joining', percent: 0 });
		const joined = joinDatasets(join || {});
		if (!joined.ok) {
			post({ id, type: 'error', reason: joined.reason || 'join-error' });
			return;
		}
		rawData = joined.rows;
		outputColumns = joined.outputColumns;
		const sourceColumns = {
			left: new Map((join.leftColumnSpecs || []).map(column => [column.name, column])),
			right: new Map((join.rightColumnSpecs || []).map(column => [column.name, column])),
		};
		// A join can narrow a text column to numeric-looking strings. Keep each
		// source's format, including when conflicting column names are renamed.
		for (const { side, source, output } of joined.columnSources) {
			const separator = sourceColumns[side].get(source)?.decimalSeparator;
			if (separator === '.' || separator === ',') inheritedSeparators.set(output, separator);
		}
		post({ id, type: 'progress', stage: 'joining', percent: 30 });
	} else {
		post({ id, type: 'progress', stage: 'parsing', percent: 0 });
		const parsed = kind === 'json' ? parseJson(text) : parseCsv(text);
		if (!parsed.ok) {
			post({ id, type: 'error', reason: parsed.reason });
			return;
		}
		rawData = parsed.rows;
		post({ id, type: 'progress', stage: 'parsing', percent: 30 });
	}

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
		const result = {
			rows: [],
			columns: [],
			decimalSeparator: detectDecimalSeparator([], options.decimalSeparator),
			statsNumeric: [],
			statsCategorical: [],
			truncatedFrom,
		};
		if (outputColumns) result.outputColumns = outputColumns;
		post({
			id,
			type: 'done',
			result,
		});
		return;
	}

	post({ id, type: 'progress', stage: 'decimal-detection', percent: 32 });
	// Only strings provide locale evidence; typed JSON/joined numbers are ignored.
	const allRawValues = rawData
		.slice(0, DECIMAL_DETECTION.sampleSize)
		.flatMap(row => Object.values(row));
	const decimalSeparator = detectDecimalSeparator(allRawValues, options.decimalSeparator);
	post({ id, type: 'progress', stage: 'decimal-detection', percent: 35 });

	const columnNames = Object.keys(rawData[0]);
	const columns = [];
	for (let i = 0; i < columnNames.length; i++) {
		const name = columnNames[i];
		const values = rawData.map(row => row[name]);
		const columnSeparator = options.decimalSeparator === '.' || options.decimalSeparator === ','
			? decimalSeparator
			: inheritedSeparators.get(name) ?? decimalSeparator;
		columns.push({ name, type: detectType(values, columnSeparator), decimalSeparator: columnSeparator });
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

	const result = { rows, columns, decimalSeparator, statsNumeric, statsCategorical, truncatedFrom };
	if (outputColumns) result.outputColumns = outputColumns;
	post({ id, type: 'done', result });
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
