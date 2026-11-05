/**
 * CHIVE chart-configuration product rules.
 *
 * Owns deep merge with static defaults, legacy migration, malformed-block
 * hardening, the enumerated-value check against each chart's definition, and
 * column-aware stale-filter trimming. This module is pure and DOM-free; the
 * default data itself lives in config/charts/definitions/.
 *
 * @typedef {import('../../types.js').ChartConfig} ChartConfig
 */

import { createDefaultChartConfig } from '../../config/charts/defaults.js';
import { CHART_DEFINITIONS } from '../../config/charts/definitions.js';
import { normalizeGlobalFilter, createEmptyGlobalFilter, resolveGlobalFilterForColumns } from '../filters/globalFilter.js';

/**
 * Return `value` when it is a plain object, otherwise an empty object. Keeps
 * malformed input (string/array/number/null) from spreading stray keys into a
 * merged config.
 *
 * @private
 * @param {*} value
 * @returns {Object}
 */
function asPlainObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

/**
 * Pull the global filter out of a saved config, normalizing legacy shapes.
 *
 * @private
 * @param {*} config
 * @returns {import('../../types.js').GlobalFilter}
 */
function pickGlobalFilter(config) {
	if (!config || typeof config !== 'object') {
		return createEmptyGlobalFilter();
	}
	return normalizeGlobalFilter(config.globalFilter);
}

/**
 * Return `block` with each enumerated setting whose value the chart does not
 * offer replaced by the chart's default. Returns `block` itself when every
 * value is offered.
 *
 * @private
 * @param {Object} block - A merged chart block.
 * @param {Object<string, ReadonlyArray<*>>} allowedValues - Config key to the values the chart offers, from its definition.
 * @param {Object} defaultBlock - The chart's default block.
 * @returns {Object}
 */
function withAllowedValues(block, allowedValues, defaultBlock) {
	const replaced = Object.keys(allowedValues)
		.filter(key => !allowedValues[key].includes(block[key]))
		.map(key => [key, defaultBlock[key]]);
	return replaced.length === 0 ? block : { ...block, ...Object.fromEntries(replaced) };
}

/**
 * Deep-merge `chartConfig` onto the defaults. User-set fields always
 * win; missing fields fall back to defaults. The merge is per-chart-type
 * (each `bar`, `scatter`, … block is independently shallow-merged), with
 * one nested case (`scatter.regression`) handled explicitly.
 *
 * The `bubble` block has special handling: if the saved config lacks
 * `nestingColumns` but has a legacy single `groupColumn`, it is promoted
 * into a one-element `nestingColumns` array. This preserves pre-multilevel
 * bubble configs across reloads.
 *
 * Each block's enumerated settings, the keys of its chart definition's
 * `allowedValues`, then hold only values the chart offers: any other value
 * becomes the chart's default. The check runs here, not only in
 * {@link canonicalizeChartConfig}, so render, the controls sidebar, Panel
 * captures and Panel rehydration read the same values.
 *
 * @param {*} chartConfig - Saved (possibly partial) chart config, or `null`/`undefined`.
 * @returns {ChartConfig} Merged, fully-populated config.
 */
export function mergeChartConfigWithDefaults(chartConfig) {
	const defaults = createDefaultChartConfig();
	// Guard against non-object input: a string/array/number would otherwise spread
	// into stray index keys instead of being treated as "no saved config". The same
	// guard runs per chart block below, so a malformed block also falls back to
	// defaults wherever this function is called (render, capture, hydration, controls).
	const config = asPlainObject(chartConfig);
	const scatterConfig = asPlainObject(config.scatter);

	const merged = {
		...defaults,
		...config,
		globalFilter: pickGlobalFilter(config),
		bar: {
			...defaults.bar,
			...asPlainObject(config.bar),
		},
		scatter: {
			...defaults.scatter,
			...scatterConfig,
			regression: {
				...defaults.scatter.regression,
				...asPlainObject(scatterConfig.regression),
			},
		},
		network: {
			...defaults.network,
			...asPlainObject(config.network),
		},
		pie: {
			...defaults.pie,
			...asPlainObject(config.pie),
		},
		treemap: {
			...defaults.treemap,
			...asPlainObject(config.treemap),
		},
		bubble: (() => {
			const merged = { ...defaults.bubble, ...asPlainObject(config.bubble) };
			if (Array.isArray(merged.nestingColumns) && merged.nestingColumns.length > 0) {
				// nestingColumns already set, keep it
			} else if (merged.groupColumn && typeof merged.groupColumn === 'string') {
				merged.nestingColumns = [merged.groupColumn];
			} else {
				merged.nestingColumns = [];
			}
			return merged;
		})(),
		line: {
			...defaults.line,
			...asPlainObject(config.line),
		},
		tin: {
			...defaults.tin,
			...asPlainObject(config.tin),
		},
		scatter3d: {
			...defaults.scatter3d,
			...asPlainObject(config.scatter3d),
		},
	};

	for (const { key, allowedValues } of Object.values(CHART_DEFINITIONS)) {
		if (allowedValues) merged[key] = withAllowedValues(merged[key], allowedValues, defaults[key]);
	}
	return merged;
}

/**
 * Bring a (possibly-partial or legacy) chart config to its canonical shape:
 * default-filled and legacy-migrated via {@link mergeChartConfigWithDefaults},
 * then stale global-filter rules trimmed against `columnNames`. Pure and
 * idempotent. "Canonical" here means object/default shape, legacy migration,
 * the enumerated settings each chart definition lists in `allowedValues`, and
 * stale-column filter cleanup; it does not validate other scalar values and does
 * not strip unknown top-level keys.
 *
 * @param {*} chartConfig - Saved (possibly partial/malformed) chart config.
 * @param {string[]} [columnNames] - Dataset column names. Omit when column context is not trustworthy: filter rules are then kept (shape-normalized) rather than trimmed, since `resolveGlobalFilterForColumns` would treat a non-array as "no columns" and drop them all.
 * @returns {ChartConfig} Canonical config.
 */
export function canonicalizeChartConfig(chartConfig, columnNames) {
	const merged = mergeChartConfigWithDefaults(chartConfig);
	if (!Array.isArray(columnNames)) return merged;
	return {
		...merged,
		globalFilter: resolveGlobalFilterForColumns(merged.globalFilter, columnNames),
	};
}
