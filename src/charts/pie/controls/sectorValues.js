/**
 * Pie sector ordering and swatch colors (package-private).
 *
 * Computes the full aggregated category-key order used by the color controls,
 * and the color each per-slice swatch shows. The order is shared by the
 * builder (per-slice color grid order) and the listeners (palette-preset to
 * per-slice color mapping), so it lives in its own module rather than being
 * owned by either consumer. The swatch colors are the fills of the sectors
 * the chart draws, from `computePieSectors`, over the rows the chart draws,
 * which the controls registry hands the builder. Pure: reads rows + config,
 * touches no DOM.
 */

import { aggregateCategories } from '../../shared/categoryAggregation.js';
import { normalizePieOptions } from '../options.js';
import { computePieSectors } from '../data.js';

/**
 * Every source category in the chart's aggregate order, projected from
 * {@link aggregateCategories} so the controls and the rendered chart agree
 * on which categories exist. Pass every dataset row: neither the global
 * filter, Top-N nor the chart's rule that a sector needs a value above 0 is
 * applied, so controls retain colors for source categories that the current
 * filter or Top-N hides, and for categories whose total is 0 or less, which a
 * global filter can leave above 0. Slice colors are keyed by category key, so
 * the Other sector, which is not a category, has no entry.
 *
 * @internal Package-private to `controls/`; imported only by the builder and listeners.
 * @param {Array<Object<string, *>>} rows - Every row of the dataset.
 * @param {Object} config - The pie config block.
 * @param {{ missingLabel?: string }} [options] - Localized label of the missing bucket.
 * @returns {Array<{ key: string, label: string }>}
 */
export function getPieSectorValues(rows, config, { missingLabel } = {}) {
	if (!config?.category || !Array.isArray(rows)) return [];

	const aggregated = aggregateCategories(rows, config.category, {
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
 * @param {Array<Object<string, *>>} drawnRows - The rows the chart draws: the dataset's rows under its global filter.
 * @param {Object} config - The pie config block.
 * @returns {Object<string, string>} Hex color by key.
 */
export function getPieSwatchColors(drawnRows, config) {
	if (!config?.category || !Array.isArray(drawnRows)) return {};

	// WHY: shades follow the drawn order, so a global filter that hides a
	// larger sector moves the others up a shade. Only the drawn rows give
	// the order the chart draws.
	const drawn = computePieSectors(drawnRows, config.category, normalizePieOptions(config));
	const fills = drawn.ok ? drawn.sectors.map(({ key, color }) => [key, color]) : [];
	return { ...config.customSliceColors, ...Object.fromEntries(fills) };
}
