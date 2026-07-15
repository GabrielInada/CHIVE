import { max, mean, median, min } from '../../../vendor/d3/d3.js';
import { isNullish } from '../../utils/formatters.js';

/**
 * CHIVE per-column statistics.
 *
 * Pure functions computing numeric (n, min, max, mean, median) and
 * categorical (mode, top-5 share, missingness, uniqueness) statistics. No
 * DOM, no state, no I/O, safe to use in workers and tests.
 *
 * @typedef {import('../../types.js').ColumnSpec} ColumnSpec
 * @typedef {import('../../types.js').NumericColumnStats} NumericColumnStats
 * @typedef {import('../../types.js').CategoricalColumnStats} CategoricalColumnStats
 */

/**
 * Compute per-column numeric statistics (n, min, max, mean, median).
 * Columns with `type !== 'number'` are skipped; numeric columns with no
 * finite values are also skipped (the function does not return null
 * placeholders).
 *
 * @param {Array<Object<string, *>>} rows
 * @param {ColumnSpec[]} columns
 * @returns {NumericColumnStats[]}
 */
export function calculateStatistics(rows, columns) {
	return columns
		.filter(column => column.type === 'number')
		.map(({ name }) => {
			const values = rows
				.map(row => row[name])
				.filter(value => value !== null && value !== undefined && !isNaN(value));

			if (values.length === 0) return null;

			return {
				name,
				n: values.length,
				min: min(values),
				max: max(values),
				mean: mean(values),
				median: median(values),
			};
		})
		.filter(Boolean);
}

/**
 * Treat null, undefined, and whitespace-only strings as missing.
 *
 * @private
 */
function isMissingValue(value) {
	if (isNullish(value)) return true;
	if (typeof value === 'string' && value.trim() === '') return true;
	return false;
}

/**
 * Compute per-column categorical statistics (mode, top-5 share,
 * missingness) for every non-numeric column. Columns where every value
 * is missing return `empty: true` with zeroed counts so renderers can
 * draw a uniform "no data" state.
 *
 * @param {Array<Object<string, *>>} rows
 * @param {ColumnSpec[]} columns
 * @returns {CategoricalColumnStats[]} One entry per non-numeric column, in source order.
 */
export function calculateCategoricalStatistics(rows, columns) {
	return columns
		.filter(column => column.type !== 'number')
		.map(({ name }) => {
			const counts = new Map();
			let missing = 0;
			let n = 0;

			for (let i = 0; i < rows.length; i++) {
				const value = rows[i]?.[name];
				if (isMissingValue(value)) {
					missing++;
					continue;
				}
				const key = String(value);
				counts.set(key, (counts.get(key) || 0) + 1);
				n++;
			}

			const total = n + missing;
			const unique = counts.size;

			if (n === 0) {
				return {
					name,
					n: 0,
					missing,
					missingPct: total > 0 ? missing / total : 0,
					unique: 0,
					uniquenessRate: 0,
					mode: null,
					modeCount: 0,
					modePct: 0,
					top5Pct: 0,
					empty: true,
				};
			}

			let mode = null;
			let modeCount = 0;
			for (const [key, count] of counts) {
				if (count > modeCount || (count === modeCount && (mode === null || key.localeCompare(mode) < 0))) {
					mode = key;
					modeCount = count;
				}
			}

			const top5Sum = Array.from(counts.values())
				.sort((a, b) => b - a)
				.slice(0, 5)
				.reduce((sum, c) => sum + c, 0);

			return {
				name,
				n,
				missing,
				missingPct: total > 0 ? missing / total : 0,
				unique,
				uniquenessRate: n > 0 ? unique / n : 0,
				mode,
				modeCount,
				modePct: n > 0 ? modeCount / n : 0,
				top5Pct: n > 0 ? top5Sum / n : 0,
				empty: false,
			};
		});
}
