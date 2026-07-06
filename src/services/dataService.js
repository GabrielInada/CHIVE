/**
 * CHIVE data service (public facade).
 *
 * Pure functions for CSV/JSON parsing, type/decimal detection, row
 * normalization, dataset joins, and per-column statistics. No DOM, no
 * state, no I/O, safe to use in workers and tests.
 *
 * The implementation lives in the `dataService/` folder, split by
 * responsibility; this file is the single public entry point and keeps the
 * export surface stable for every consumer (and the services barrel). Only
 * `formatFileSize` is defined inline, to avoid a one-function micro-module.
 */

export { joinDatasets } from './dataService/join.js';
export { detectDelimiter, parseCsv, parseJson } from './dataService/parse.js';
export { normalizeNumericString, detectDecimalSeparator, detectType } from './dataService/typeDetection.js';
export { processData } from './dataService/processData.js';
export { calculateStatistics, calculateCategoricalStatistics } from './dataService/statistics.js';

/**
 * Format a byte count as a human-readable label. Three tiers:
 *   - `< 1 KB`  → `"<N> B"`
 *   - `< 1 MB`  → `"<N.N> KB"` (1 decimal)
 *   - otherwise → `"<N.N> MB"` (1 decimal)
 *
 * @param {number} sizeBytes
 * @returns {string}
 */
export function formatFileSize(sizeBytes) {
	if (sizeBytes < 1024) return `${sizeBytes} B`;
	if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
	return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
