/**
 * CHIVE Data Ingest Worker
 *
 * Runs parse + type detection + numeric normalization + stats off the main
 * thread so a 200k-row upload no longer freezes the tab. Posts progress
 * messages between stages so the host can drive a corner-toast progress bar.
 *
 * Pure logic comes from `services/dataService.js` (no DOM deps). The
 * row-normalization loop is duplicated here as `chunkedNormalize` so it can
 * yield progress between batches; the canonical sync `processData` in
 * dataService.js stays untouched (still used by the join builder + tests).
 *
 * Message protocol — see `services/dataIngestService.js` for the host side.
 */

import {
	parseCsv,
	parseJson,
	detectDecimalSeparator,
	detectType,
	normalizeNumericString,
	calculateStatistics,
	calculateCategoricalStatistics,
} from '../services/dataService.js';
import { DECIMAL_DETECTION, COLUMN_TYPES } from '../config/types.js';

const NORMALIZE_CHUNK_SIZE = 20000;

/**
 * Convert raw rows to typed rows in chunks, invoking `onChunk(done, total)`
 * between each chunk so callers can post progress messages.
 *
 * Exported so tests can exercise the loop without spawning a real Worker.
 */
export function chunkedNormalize(rawData, colunas, decimalSeparator, onChunk, chunkSize = NORMALIZE_CHUNK_SIZE) {
	const out = new Array(rawData.length);

	for (let i = 0; i < rawData.length; i += chunkSize) {
		const end = Math.min(i + chunkSize, rawData.length);
		for (let j = i; j < end; j++) {
			const row = rawData[j];
			const converted = {};
			for (const { nome, tipo } of colunas) {
				const value = row[nome];
				if (tipo === COLUMN_TYPES.NUMBER && value !== '' && value !== null && value !== undefined) {
					converted[nome] = Number(normalizeNumericString(String(value), decimalSeparator));
				} else {
					converted[nome] = value;
				}
			}
			out[j] = converted;
		}
		if (onChunk) onChunk(end, rawData.length);
	}

	return out;
}

/**
 * Run the full ingest pipeline. Throws on parse/empty-file errors; the
 * onmessage wrapper catches and posts an `error` message.
 *
 * Exported so tests can drive the pipeline directly with a synthetic post fn.
 */
export function runIngest({ id, kind, text, options = {} }, post) {
	const rowLimit = Number.isFinite(options.rowLimit) ? options.rowLimit : Infinity;

	post({ id, type: 'progress', stage: 'parsing', percent: 0 });
	let rawData = kind === 'json' ? parseJson(text) : parseCsv(text);
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
				dados: [],
				colunas: [],
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
	const colunas = [];
	for (let i = 0; i < columnNames.length; i++) {
		const name = columnNames[i];
		const values = rawData.map(row => row[name]);
		colunas.push({ nome: name, tipo: detectType(values, decimalSeparator) });
		const pct = 35 + Math.round(((i + 1) / columnNames.length) * 15);
		post({ id, type: 'progress', stage: 'type-detection', percent: pct });
	}

	const dados = chunkedNormalize(rawData, colunas, decimalSeparator, (done, total) => {
		const pct = 50 + Math.round((done / total) * 40);
		post({ id, type: 'progress', stage: 'normalize', percent: pct });
	});

	post({ id, type: 'progress', stage: 'stats', percent: 92 });
	const statsNumeric = calculateStatistics(dados, colunas);
	post({ id, type: 'progress', stage: 'stats', percent: 96 });
	const statsCategorical = calculateCategoricalStatistics(dados, colunas);
	post({ id, type: 'progress', stage: 'stats', percent: 100 });

	post({
		id,
		type: 'done',
		result: { dados, colunas, decimalSeparator, statsNumeric, statsCategorical, truncatedFrom },
	});
}

// Worker-context entry point. Guarded so this module can be imported as a
// regular ES module by tests without registering a global onmessage handler.
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
