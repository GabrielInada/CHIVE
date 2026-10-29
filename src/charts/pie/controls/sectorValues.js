/**
 * Pie sector ordering and swatch colors (package-private).
 *
 * Computes the full aggregated category-key order used by the color controls,
 * and the color each per-slice swatch shows. The order is shared by the
 * builder (per-slice color grid order) and the listeners (palette-preset to
 * per-slice color mapping), so it lives in its own module rather than being
 * owned by either consumer. Pure: reads rows + config, touches no DOM.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 */

import { filterDataset } from '../../../domain/filters/datasetFilter.js';
import { resolveSliceColors } from '../color.js';
import { aggregatePieData } from '../data.js';
import { normalizePieOptions } from '../options.js';

/**
 * Every source category in the chart's aggregate order, projected from
 * {@link aggregatePieData} so the controls and the rendered chart agree on
 * which sectors exist. Top-N is intentionally not applied: controls retain
 * colors for source categories that may be hidden by the current Top-N,
 * while the synthetic Other sector always uses its fixed color. Slice colors
 * are keyed by category key.
 *
 * @internal Package-private to `controls/`; imported only by the builder and listeners.
 * @param {Dataset} dataset
 * @param {Object} config - The pie config block.
 * @param {{ missingLabel?: string }} [options] - Localized label of the missing bucket.
 * @returns {Array<{ key: string, label: string }>}
 */
export function getPieSectorValues(dataset, config, { missingLabel } = {}) {
	if (!config?.category || !Array.isArray(dataset?.rows)) return [];

	const aggregated = aggregatePieData(dataset.rows, config.category, {
		measureMode: config.measureMode,
		valueColumn: config.valueColumn,
		topN: 0,
		missingLabel,
	});
	if (!aggregated.ok) return [];
	return aggregated.entries.map(({ key, label }) => ({ key, label }));
}

/**
 * Swatch color per category key for the per-slice color grid: the color the
 * chart draws the category with, else its custom color. Categories with
 * neither (hidden by the global filter or past Top-N, with no override) are
 * left out, so the grid shows its neutral swatch for them.
 *
 * @internal Package-private to `controls/`; imported only by the builder.
 * @param {Dataset} dataset
 * @param {Object} config - The pie config block.
 * @returns {Object<string, string>} Hex color by category key.
 */
export function getPieSwatchColors(dataset, config) {
	if (!config?.category || !Array.isArray(dataset?.rows)) return {};

	const options = normalizePieOptions(config);
	const swatches = { ...options.customSliceColors };
	// WHY: shades follow the drawn order, so a global filter that hides a
	// larger sector moves the others up a shade. Aggregate the rows the chart
	// draws, which come from the same filterDataset call.
	const drawnRows = filterDataset(dataset).rows;
	const drawn = aggregatePieData(drawnRows, config.category, {
		measureMode: options.measureMode,
		valueColumn: options.valueColumn,
		topN: options.topN,
		topNMode: options.topNMode,
		otherLabel: options.labels.other,
	});
	if (!drawn.ok) return swatches;

	const colors = resolveSliceColors(drawn.entries, options);
	drawn.entries.forEach(entry => {
		if (!entry.isOther) swatches[entry.key] = colors.get(entry.key);
	});
	return swatches;
}
