/**
 * Chart presentation catalog.
 *
 * Chart identity, ordering, and category keys live in the per-chart
 * definitions. This module joins that data with UI-only preview markup for the
 * dataset workspace. It deliberately does not import renderers, controls,
 * state, or services.
 *
 * @typedef {import('../types.js').ChartTypeKey} ChartTypeKey
 * @typedef {{ previewSvg: string, categoryKey: string }} ChartCatalogEntry
 */

import {
	CHART_DEFINITIONS,
	CHART_TYPE_KEYS,
} from '../config/charts/definitions.js';
import { CHART_PREVIEWS } from './previews.js';

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
export const CHART_CATALOG = Object.freeze(Object.fromEntries(
	CHART_TYPE_KEYS.map(key => [
		key,
		defineCatalogEntry(
			CHART_PREVIEWS[key],
			CHART_DEFINITIONS[key].catalogCategoryKey,
		),
	]),
));
