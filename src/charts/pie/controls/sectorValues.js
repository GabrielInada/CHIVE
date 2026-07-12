/**
 * Pie sector ordering (package-private).
 *
 * Computes the full aggregated category-token order used by the color controls.
 * Shared by the builder (per-slice color grid order) and the listeners
 * (palette-preset to per-slice color mapping), so it lives in its own module
 * rather than being owned by either consumer. Pure: reads rows + config,
 * touches no DOM.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 */

import { isNullish } from '../../../utils/formatters.js';
import { compareStrings } from '../../../utils/chartFilters.js';

/**
 * Compute every source category in descending aggregate order, with a string
 * tiebreaker so order is stable. Used to drive the per-slice color picker grid
 * and palette-preset mapping. Top-N is intentionally not applied: controls
 * retain colors for source categories that may be hidden by the current Top-N,
 * while the synthetic Other sector always uses its fixed color. Missing values
 * bucket under `'N/A'`.
 *
 * @internal Package-private to `controls/`; imported only by the builder and listeners.
 * @param {Dataset} dataset
 * @param {Object} config - The pie config block.
 * @returns {string[]}
 */
export function getPieSectorValues(dataset, config) {
	if (!config?.category || !Array.isArray(dataset?.rows)) return [];

	const counter = new Map();
	dataset.rows.forEach(row => {
		const rawValue = row[config.category];
		const category = isNullish(rawValue) || rawValue === ''
			? 'N/A'
			: String(rawValue);

		if (config.measureMode === 'sum') {
			if (!config.valueColumn) return;
			const numericValue = Number(row[config.valueColumn]);
			if (!Number.isFinite(numericValue)) return;
			counter.set(category, (counter.get(category) || 0) + numericValue);
			return;
		}

		counter.set(category, (counter.get(category) || 0) + 1);
	});

	return Array.from(counter.entries())
		.sort((a, b) => b[1] - a[1] || compareStrings(a[0], b[0]))
		.map(([category]) => category);
}
