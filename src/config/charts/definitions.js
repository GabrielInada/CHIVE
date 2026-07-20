/**
 * Canonical chart-definition composition.
 *
 * Per-chart owner modules supply static identity, defaults, dimensions, colors,
 * and DOM metadata. This module owns their visual order and derives the shared
 * keyed views consumed across the application. It does not register renderers,
 * controls, or panel implementations.
 *
 * @typedef {import('../../types.js').ChartTypeKey} ChartTypeKey
 */

import { BAR_DEFINITION } from './definitions/bar.js';
import { LINE_DEFINITION } from './definitions/line.js';
import { SCATTER_DEFINITION } from './definitions/scatter.js';
import { SCATTER3D_DEFINITION } from './definitions/scatter3d.js';
import { PIE_DEFINITION } from './definitions/pie.js';
import { BUBBLE_DEFINITION } from './definitions/bubble.js';
import { NETWORK_DEFINITION } from './definitions/network.js';
import { TREEMAP_DEFINITION } from './definitions/treemap.js';
import { TIN_DEFINITION } from './definitions/tin.js';

const ORDERED_DEFINITIONS = Object.freeze([
	BAR_DEFINITION,
	LINE_DEFINITION,
	SCATTER_DEFINITION,
	SCATTER3D_DEFINITION,
	PIE_DEFINITION,
	BUBBLE_DEFINITION,
	NETWORK_DEFINITION,
	TREEMAP_DEFINITION,
	TIN_DEFINITION,
]);

/**
 * Definitions keyed by canonical chart identity in visual order.
 */
export const CHART_DEFINITIONS = Object.freeze(Object.fromEntries(
	ORDERED_DEFINITIONS.map(definition => [definition.key, definition]),
));

/**
 * Supported chart keys in canonical visual order.
 *
 * @type {ReadonlyArray<ChartTypeKey>}
 */
export const CHART_TYPE_KEYS = Object.freeze(
	ORDERED_DEFINITIONS.map(definition => definition.key),
);

export const CHART_COLORS = Object.freeze(Object.fromEntries(
	ORDERED_DEFINITIONS.map(definition => [definition.key, definition.color]),
));

export const CHART_DIMENSIONS = Object.freeze(Object.fromEntries(
	ORDERED_DEFINITIONS
		.filter(definition => definition.dimensions !== null)
		.map(definition => [definition.key, definition.dimensions]),
));

export const CHART_HEIGHT_LIMITS = Object.freeze(Object.fromEntries(
	ORDERED_DEFINITIONS.map(definition => [definition.key, definition.heightLimits]),
));
