/**
 * Pie sector ordering and swatch colors (package-private).
 *
 * Computes the full aggregated category-key order used by the color controls,
 * and the color each per-slice swatch shows. The order is shared by the
 * builder (per-slice color grid order) and the listeners (palette-preset to
 * per-slice color mapping), so it lives in its own module rather than being
 * owned by either consumer. The swatch colors are the fills of the sectors
 * the chart draws, from `computePieSectors`. Pure: reads rows + config,
 * touches no DOM.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 */

import { filterDataset } from '../../../domain/filters/datasetFilter.js';
import { aggregatePieCategories, computePieSectors } from '../data.js';

/**
 * Every source category in the chart's aggregate order, projected from
 * {@link aggregatePieCategories} so the controls and the rendered chart agree
 * on which categories exist. Neither Top-N nor the chart's rule that a sector
 * needs a value above 0 is applied: controls retain colors for source
 * categories that may be hidden by the current Top-N, and for categories
 * whose total is 0 or less, which a global filter can leave above 0. Slice
 * colors are keyed by category key, so the Other sector, which is not a
 * category, has no entry.
 *
 * @internal Package-private to `controls/`; imported only by the builder and listeners.
 * @param {Dataset} dataset
 * @param {Object} config - The pie config block.
 * @param {{ missingLabel?: string }} [options] - Localized label of the missing bucket.
 * @returns {Array<{ key: string, label: string }>}
 */
export function getPieSectorValues(dataset, config, { missingLabel } = {}) {
	if (!config?.category || !Array.isArray(dataset?.rows)) return [];

	const aggregated = aggregatePieCategories(dataset.rows, config.category, {
		measureMode: config.measureMode,
		valueColumn: config.valueColumn,
		missingLabel,
	});
	if (!aggregated.ok) return [];
	return aggregated.entries.map(({ key, label }) => ({ key, label }));
}

/**
 * Swatch colors for the per-slice color grid: the fill of every sector the
 * chart draws, by sector key, over the custom slice colors. The grid looks
 * up category keys, so a category the chart does not draw (hidden by the
 * global filter, past Top-N or with a total of 0 or less) shows its custom
 * color, or the grid's neutral swatch without one.
 *
 * @internal Package-private to `controls/`; imported only by the builder.
 * @param {Dataset} dataset
 * @param {Object} config - The pie config block.
 * @returns {Object<string, string>} Hex color by key.
 */
export function getPieSwatchColors(dataset, config) {
	if (!config?.category || !Array.isArray(dataset?.rows)) return {};

	// WHY: shades follow the drawn order, so a global filter that hides a
	// larger sector moves the others up a shade. Take the rows the chart
	// draws, which come from the same filterDataset call.
	const drawn = computePieSectors(filterDataset(dataset).rows, config.category, config);
	const fills = drawn.ok ? drawn.sectors.map(({ key, color }) => [key, color]) : [];
	return { ...config.customSliceColors, ...Object.fromEntries(fills) };
}
