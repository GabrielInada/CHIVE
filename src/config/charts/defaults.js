/**
 * CHIVE per-dataset chart configuration defaults.
 *
 * `createDefaultChartConfig` returns the canonical fresh shape that every
 * new dataset starts with. Each chart-specific block is created by its owner
 * definition; merge and canonicalization product rules live in
 * `src/domain/charts/chartConfig.js`.
 *
 * @typedef {import('../../types.js').ChartConfig} ChartConfig
 */

import { createEmptyGlobalFilter } from '../../domain/filters/globalFilter.js';
import { CHART_DEFINITIONS } from './definitions.js';

/**
 * Build a fresh {@link ChartConfig}. Every new dataset starts with this
 * shape; chart-specific configs default to `enabled: false`, with column
 * bindings (`category`, `x`, `y`, …) `null` until the user picks one in
 * the sidebar.
 *
 * Mutating the returned object is safe, it is freshly constructed on
 * each call.
 *
 * @returns {ChartConfig}
 */
export function createDefaultChartConfig() {
	const config = {
		activeTab: 'preview',
		globalFilter: createEmptyGlobalFilter(),
	};

	for (const definition of Object.values(CHART_DEFINITIONS)) {
		config[definition.key] = definition.createDefaultConfig();
	}

	return config;
}
