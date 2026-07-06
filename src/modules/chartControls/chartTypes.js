/**
 * CHIVE chart-type registry.
 *
 * Single source of truth for the supported chart types and their display
 * metadata. The ordering in {@link CHART_TYPES} is the canonical visual
 * order used by the chart-type picker dialog.
 *
 * @typedef {import('../../types.js').ChartTypeKey} ChartTypeKey
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
 * Chart-type ids in canonical visual order. Used by the picker dialog
 * and by the sidebar's "first match wins" active-chart detection.
 *
 * @type {ReadonlyArray<ChartTypeKey>}
 */
export const CHART_TYPES = ['bar', 'line', 'scatter', 'scatter3d', 'pie', 'bubble', 'network', 'treemap', 'tin'];

/**
 * Hardcoded preview SVG markup, keyed by {@link ChartTypeKey}. Consumed
 * by the picker dialog and other chart-type-presentation UI.
 *
 * @type {Object<ChartTypeKey, string>}
 */
export const PREVIEW_SVGS = {
	bar: PREVIEW_BAR_SVG,
	scatter: PREVIEW_SCATTER_SVG,
	scatter3d: PREVIEW_SCATTER3D_SVG,
	pie: PREVIEW_PIE_SVG,
	bubble: PREVIEW_BUBBLE_SVG,
	network: PREVIEW_NETWORK_SVG,
	treemap: PREVIEW_TREEMAP_SVG,
	line: PREVIEW_LINE_SVG,
	tin: PREVIEW_TIN_SVG,
};

/**
 * Map of chart type → i18n key for its high-level category label
 * (`'comparison'`, `'relationship'`, …). Used by the picker dialog to
 * group similar charts.
 *
 * @type {Object<ChartTypeKey, string>}
 */
export const CATEGORY_KEYS = {
	bar: 'chive-viz-category-comparison',
	scatter: 'chive-viz-category-relationship',
	scatter3d: 'chive-viz-category-relationship',
	pie: 'chive-viz-category-composition',
	bubble: 'chive-viz-category-hierarchy',
	network: 'chive-viz-category-relationship',
	treemap: 'chive-viz-category-composition',
	line: 'chive-viz-category-trend',
	tin: 'chive-viz-category-spatial',
};
