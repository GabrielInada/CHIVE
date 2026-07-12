/**
 * Chart presentation catalog.
 *
 * Chart identity and ordering live in `config/chartTypes.js`. This module owns
 * UI-only metadata used to present those chart types in the dataset workspace.
 * It deliberately does not import renderers, controls, state, or services.
 *
 * @typedef {import('../types.js').ChartTypeKey} ChartTypeKey
 * @typedef {{ previewSvg: string, categoryKey: string }} ChartCatalogEntry
 */

import {
	PREVIEW_BAR_SVG,
	PREVIEW_BUBBLE_SVG,
	PREVIEW_LINE_SVG,
	PREVIEW_NETWORK_SVG,
	PREVIEW_PIE_SVG,
	PREVIEW_SCATTER_SVG,
	PREVIEW_SCATTER3D_SVG,
	PREVIEW_TIN_SVG,
	PREVIEW_TREEMAP_SVG,
} from './previews.js';

/**
 * Build an immutable presentation entry.
 *
 * @param {string} previewSvg
 * @param {string} categoryKey
 * @returns {Readonly<ChartCatalogEntry>}
 */
function defineCatalogEntry(previewSvg, categoryKey) {
	return Object.freeze({ previewSvg, categoryKey });
}

/**
 * User-facing chart metadata keyed by chart identity. Ordering belongs to
 * `CHART_TYPE_KEYS`; consumers that render an ordered list should iterate that
 * array and look up each entry here.
 *
 * @type {Readonly<Object<ChartTypeKey, Readonly<ChartCatalogEntry>>>}
 */
export const CHART_CATALOG = Object.freeze({
	bar: defineCatalogEntry(PREVIEW_BAR_SVG, 'chive-viz-category-comparison'),
	line: defineCatalogEntry(PREVIEW_LINE_SVG, 'chive-viz-category-trend'),
	scatter: defineCatalogEntry(PREVIEW_SCATTER_SVG, 'chive-viz-category-relationship'),
	scatter3d: defineCatalogEntry(PREVIEW_SCATTER3D_SVG, 'chive-viz-category-relationship'),
	pie: defineCatalogEntry(PREVIEW_PIE_SVG, 'chive-viz-category-composition'),
	bubble: defineCatalogEntry(PREVIEW_BUBBLE_SVG, 'chive-viz-category-hierarchy'),
	network: defineCatalogEntry(PREVIEW_NETWORK_SVG, 'chive-viz-category-relationship'),
	treemap: defineCatalogEntry(PREVIEW_TREEMAP_SVG, 'chive-viz-category-composition'),
	tin: defineCatalogEntry(PREVIEW_TIN_SVG, 'chive-viz-category-spatial'),
});
