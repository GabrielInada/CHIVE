import { parseCsv, parseJson } from './parse.js';
import { joinDatasets } from './join.js';
import { detectDecimalSeparator, detectType } from './typeDetection.js';
import { toCanonicalCell } from './cellValues.js';
import { calculateStatistics, calculateCategoricalStatistics } from './statistics.js';
import { DECIMAL_DETECTION } from '../../config/columnTypeDetection.js';
import { STATS_CATEGORICAL_VERSION, STATS_NUMERIC_VERSION } from '../../config/statistics.js';
import { ok, fail } from '../../utils/result.js';

/**
 * CHIVE dataset ingest.
 *
 * Turns a CSV or JSON file, or the join of two datasets, into a new dataset's
 * rows, columns, and stats. No DOM, no state, no I/O, safe to use in workers
 * and tests. `workers/dataIngestWorker.js` runs it off the main thread and
 * relays its progress as messages.
 *
 * @typedef {import('../../types.js').ColumnSpec} ColumnSpec
 * @typedef {import('../../types.js').IngestPayload} IngestPayload
 * @typedef {import('../../types.js').IngestProgress} IngestProgress
 * @typedef {import('../../types.js').IngestRequest} IngestRequest
 * @typedef {import('../../types.js').NumericColumnStats} NumericColumnStats
 * @typedef {import('../../types.js').CategoricalColumnStats} CategoricalColumnStats
 * @typedef {import('../../types.js').PrecomputedStats} PrecomputedStats
 * @typedef {import('../../types.js').Result} Result
 */

const NORMALIZE_CHUNK_SIZE = 20000;

/**
 * Ingest a file or a join: parse or join, drop columns, apply the row limit,
 * pick each column's decimal separator and type, canonicalize every cell, and
 * compute the stats.
 *
 * A column's decimal separator is `options.decimalSeparator` when that is a
 * dot or a comma. Otherwise a joined column keeps its source column's
 * separator, and any other column gets the one detected from the first rows'
 * strings, with a dot fallback.
 *
 * Progress goes to `onProgress` stage by stage (see {@link IngestProgress}).
 * A result with no rows reports only the first stage.
 *
 * @param {IngestRequest} request
 * @param {{ onProgress?: (progress: IngestProgress) => void }} [config]
 * @returns {Result} `ok({ value })` with the {@link IngestPayload}, or `fail(reason)` with the parser's or the join's reason. Throws only on bugs.
 */
export function ingestDataset({ kind, text, join, options = {} }, { onProgress } = {}) {
	const report = (stage, percent) => onProgress?.({ stage, percent });
	const rowLimit = Number.isFinite(options.rowLimit) ? options.rowLimit : Infinity;
	let rawData;
	let outputColumns = [];
	const inheritedSeparators = new Map();

	if (kind === 'join') {
		report('joining', 0);
		const joined = joinDatasets(join || {});
		if (!joined.ok) return fail(joined.reason || 'join-error');
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
		report('joining', 30);
	} else {
		report('parsing', 0);
		const parsed = kind === 'json' ? parseJson(text) : parseCsv(text);
		if (!parsed.ok) return fail(parsed.reason);
		rawData = parsed.rows;
		report('parsing', 30);
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
		outputColumns = outputColumns.filter(name => !dropSet.has(name));
	}

	let truncatedFrom = null;
	if (rawData.length > rowLimit) {
		truncatedFrom = rawData.length;
		rawData = rawData.slice(0, rowLimit);
	}

	const explicitSeparator = options.decimalSeparator === '.' || options.decimalSeparator === ',';
	const columnSeparator = (name, fileSeparator) => (
		explicitSeparator ? fileSeparator : inheritedSeparators.get(name) ?? fileSeparator
	);

	if (rawData.length === 0) {
		// No values to type: a join that matched nothing keeps its output columns as text.
		const fileSeparator = detectDecimalSeparator([], options.decimalSeparator);
		const columns = outputColumns.map(name => ({
			name,
			type: 'text',
			decimalSeparator: columnSeparator(name, fileSeparator),
		}));
		return ok({ value: { rows: [], columns, precomputedStats: versionedStats([], []), truncatedFrom } });
	}

	report('decimal-detection', 32);
	// Only strings provide locale evidence; typed JSON/joined numbers are ignored.
	const allRawValues = rawData
		.slice(0, DECIMAL_DETECTION.sampleSize)
		.flatMap(row => Object.values(row));
	const fileSeparator = detectDecimalSeparator(allRawValues, options.decimalSeparator);
	report('decimal-detection', 35);

	const columnNames = Object.keys(rawData[0]);
	const columns = [];
	for (let i = 0; i < columnNames.length; i++) {
		const name = columnNames[i];
		const values = rawData.map(row => row[name]);
		const decimalSeparator = columnSeparator(name, fileSeparator);
		columns.push({ name, type: detectType(values, decimalSeparator), decimalSeparator });
		report('type-detection', 35 + Math.round(((i + 1) / columnNames.length) * 15));
	}

	const rows = chunkedNormalize(rawData, columns, (done, total) => {
		report('normalize', 50 + Math.round((done / total) * 40));
	});

	report('stats', 92);
	const numeric = calculateStatistics(rows, columns);
	report('stats', 96);
	const categorical = calculateCategoricalStatistics(rows, columns);
	report('stats', 100);

	return ok({ value: { rows, columns, precomputedStats: versionedStats(numeric, categorical), truncatedFrom } });
}

/**
 * Convert raw rows to canonical rows in chunks, invoking `onChunk(done, total)`
 * after each chunk so progress can be reported between batches. Every output
 * row has every column, each cell in its column type's canonical form (see
 * `toCanonicalCell`).
 *
 * @private
 * @param {Array<Object<string, *>>} rawData
 * @param {ColumnSpec[]} columns - Each with its decimal separator.
 * @param {(done: number, total: number) => void} onChunk
 * @returns {Array<Object<string, *>>}
 */
function chunkedNormalize(rawData, columns, onChunk) {
	const out = new Array(rawData.length);
	const cells = columns.map(({ name, type, decimalSeparator }) => ({
		name,
		type,
		options: { decimalSeparator },
	}));

	for (let i = 0; i < rawData.length; i += NORMALIZE_CHUNK_SIZE) {
		const end = Math.min(i + NORMALIZE_CHUNK_SIZE, rawData.length);
		for (let j = i; j < end; j++) {
			const row = rawData[j];
			const converted = {};
			for (const { name, type, options } of cells) {
				converted[name] = toCanonicalCell(row[name], type, options);
			}
			out[j] = converted;
		}
		onChunk(end, rawData.length);
	}

	return out;
}

/**
 * Stamp stats with the generations that computed them, which the hydration
 * boundary checks.
 *
 * @private
 * @param {NumericColumnStats[]} numeric
 * @param {CategoricalColumnStats[]} categorical
 * @returns {PrecomputedStats}
 */
function versionedStats(numeric, categorical) {
	return {
		numeric,
		categorical,
		numericVersion: STATS_NUMERIC_VERSION,
		categoricalVersion: STATS_CATEGORICAL_VERSION,
	};
}
