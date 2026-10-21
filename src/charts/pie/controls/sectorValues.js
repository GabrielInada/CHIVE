/**
 * Pie sector ordering (package-private).
 *
 * Computes the full aggregated category-key order used by the color controls.
 * Shared by the builder (per-slice color grid order) and the listeners
 * (palette-preset to per-slice color mapping), so it lives in its own module
 * rather than being owned by either consumer. Pure: reads rows + config,
 * touches no DOM.
 *
 * @typedef {import('../../../types.js').Dataset} Dataset
 */

import { aggregatePieData } from '../data.js';

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
