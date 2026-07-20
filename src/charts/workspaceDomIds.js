/**
 * Static workspace DOM contracts derived from the per-chart definitions.
 */

import {
	CHART_DEFINITIONS,
	CHART_TYPE_KEYS,
} from '../config/charts/definitions.js';

export const CHART_CONTAINERS = Object.freeze(Object.fromEntries(
	CHART_TYPE_KEYS.map(key => [key, CHART_DEFINITIONS[key].workspaceIds.container]),
));

export const CHART_BLOCKS = Object.freeze(Object.fromEntries(
	CHART_TYPE_KEYS.map(key => [key, CHART_DEFINITIONS[key].workspaceIds.block]),
));
