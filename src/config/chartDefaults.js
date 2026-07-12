/**
 * CHIVE per-dataset chart configuration defaults.
 *
 * `createDefaultChartConfig` returns the canonical fresh shape that every
 * new dataset starts with; `mergeChartConfigWithDefaults` deep-merges a
 * (possibly-partial) saved config onto the defaults, user-set fields
 * always win on overlap, missing fields fall back to the default.
 *
 * The chart-specific sub-shapes live alongside the defaults here; each
 * mirrors the fields written by its package controls or legacy controls
 * module. Reach for `src/config/charts.js` for the per-chart constants that
 * feed these and `src/config/chartTypes.js` for chart identities.
 *
 * @typedef {import('../types.js').ChartConfig} ChartConfig
 */

import { BAR_CHART, BUBBLE_CHART, CHART_COLORS, LINE_CHART, NETWORK_GRAPH, PIE_CHART, SCATTER_PLOT, SCATTER3D_CHART, TIN_CHART, TREEMAP_CHART } from './charts.js';
import { normalizeGlobalFilter, createEmptyGlobalFilter, resolveGlobalFilterForColumns } from '../utils/globalFilter.js';

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
	return {
		activeTab: 'preview',
		globalFilter: createEmptyGlobalFilter(),
		bar: {
			enabled: false,
			category: null,
			expanded: false,
			customTitle: '',
			chartHeight: 320,
			sort: BAR_CHART.defaultSort,
			topN: BAR_CHART.defaultTopN,
			color: CHART_COLORS.bar,
			colorMode: 'uniform',
			colorScheme: 'Colorblind-Safe',
			gradientMinColor: CHART_COLORS.bar,
			gradientMaxColor: '#ffffff',
			gradientDistribution: 'value',
			manualThresholdPct: 50,
			showXAxisLabel: true,
			showYAxisLabel: true,
			measureMode: BAR_CHART.defaultMeasureMode,
			valueColumn: null,
		},
		scatter: {
			enabled: false,
			x: null,
			y: null,
			expanded: false,
			customTitle: '',
			chartHeight: 320,
			xScale: SCATTER_PLOT.defaultScale,
			yScale: SCATTER_PLOT.defaultScale,
			radius: SCATTER_PLOT.defaultRadius,
			opacity: SCATTER_PLOT.defaultOpacity,
			sizeMode: 'uniform',
			sizeField: null,
			sizeMin: 2,
			sizeMax: 12,
			categoricalPairMode: 'jitter',
			color: CHART_COLORS.scatter,
			colorMode: 'uniform',
			colorField: null,
			colorFieldType: null,
			gradientMinColor: CHART_COLORS.scatter,
			gradientMaxColor: '#ffffff',
			gradientDistribution: 'value',
			colorScheme: 'Colorblind-Safe',
			showXAxisLabel: true,
			showYAxisLabel: true,
			regression: {
				enabled: false,
				mode: 'overall',
				showLine: true,
				showCI: true,
				showEquation: true,
				showR2: true,
				lineWidth: 2,
				lineOpacity: 0.9,
				bandOpacity: 0.18,
				overallColor: null,
			},
		},
		network: {
			enabled: false,
			expanded: false,
			customTitle: '',
			chartHeight: 420,
			source: null,
			target: null,
			weight: null,
			group: null,
			nodeRadius: NETWORK_GRAPH.defaultNodeRadius,
			linkDistance: NETWORK_GRAPH.defaultLinkDistance,
			chargeStrength: NETWORK_GRAPH.defaultChargeStrength,
			linkOpacity: NETWORK_GRAPH.defaultLinkOpacity,
			zoomScale: NETWORK_GRAPH.defaultZoomScale,
			alphaDecay: NETWORK_GRAPH.defaultAlphaDecay,
			showLegend: true,
			showNodeLabels: false,
			colorScheme: 'Colorblind-Safe',
			sourceNodeColor: '#e3743d',
			targetNodeColor: '#6b94c9',
			edgeColorMode: 'gradient',
		},
		pie: {
			enabled: false,
			category: null,
			measureMode: 'count',
			valueColumn: null,
			expanded: false,
			customTitle: '',
			chartHeight: 360,
			innerRadius: PIE_CHART.defaultInnerRadius,
			outerRadius: PIE_CHART.defaultOuterRadius,
			padAngle: PIE_CHART.defaultPadAngle,
			zoomScale: PIE_CHART.defaultZoomScale,
			topN: PIE_CHART.defaultTopN,
			topNMode: PIE_CHART.defaultTopNMode,
			color: CHART_COLORS.pie,
			showCategoryLabel: true,
			showValueLabel: true,
			showLegend: true,
			labelPosition: 'inside',
			colorMode: 'uniform',
			colorScheme: 'Colorblind-Safe',
			customSliceColors: {},
		},
		treemap: {
			enabled: false,
			category: null,
			measureMode: TREEMAP_CHART.defaultMeasureMode,
			valueColumn: null,
			topN: TREEMAP_CHART.defaultTopN,
			padding: TREEMAP_CHART.defaultPadding,
			expanded: false,
			customTitle: '',
			chartHeight: 380,
			color: CHART_COLORS.treemap,
			colorMode: 'scheme',
			colorScheme: 'Colorblind-Safe',
			showLabels: true,
			showValues: true,
		},
		bubble: {
			enabled: false,
			expanded: false,
			category: null,
			groupColumn: null,
			nestingColumns: [],
			customTitle: '',
			chartHeight: 700,
			topN: BUBBLE_CHART.defaultTopN,
			measureMode: BUBBLE_CHART.defaultMeasureMode,
			valueColumn: null,
			padding: BUBBLE_CHART.defaultPadding,
			labelMode: BUBBLE_CHART.defaultLabelMode,
			nestingMode: BUBBLE_CHART.defaultNestingMode,
			colorScheme: 'Tableau10',
		},
		line: {
			enabled: false,
			expanded: false,
			x: null,
			y: null,
			customTitle: '',
			chartHeight: 320,
			curve: LINE_CHART.defaultCurve,
			missingMode: LINE_CHART.defaultMissingMode,
			strokeWidth: LINE_CHART.defaultStrokeWidth,
			color: CHART_COLORS.line,
			ghostStrokeColor: LINE_CHART.defaultGhostStrokeColor,
			showPoints: LINE_CHART.defaultPointsVisible,
			sortX: LINE_CHART.defaultSortX,
			aggregateMode: LINE_CHART.defaultAggregateMode,
			showXAxisLabel: true,
			showYAxisLabel: true,
		},
		tin: {
			enabled: false,
			expanded: false,
			x: null,
			y: null,
			z: null,
			customTitle: '',
			chartHeight: 460,
			fillMode: TIN_CHART.defaultFillMode,
			subdivisionDepth: TIN_CHART.defaultSubdivisionDepth,
			colorRamp: TIN_CHART.defaultColorRamp,
			gradientMinColor: CHART_COLORS.tin,
			gradientMaxColor: '#ffffff',
			gradientDistribution: 'value',
			colorScheme: 'Colorblind-Safe',
			showEdges: TIN_CHART.defaultShowEdges,
			edgeColor: TIN_CHART.defaultEdgeColor,
			showPoints: TIN_CHART.defaultShowPoints,
			pointRadius: TIN_CHART.defaultPointRadius,
			showZLabels: TIN_CHART.defaultShowZLabels,
			showHull: TIN_CHART.defaultShowHull,
			hullColor: TIN_CHART.defaultHullColor,
			showIsolines: TIN_CHART.defaultShowIsolines,
			isolineMode: TIN_CHART.defaultIsolineMode,
			isolineCount: TIN_CHART.defaultIsolineCount,
			isolineStep: TIN_CHART.defaultIsolineStep,
			isolineColor: TIN_CHART.defaultIsolineColor,
			isolineWidth: TIN_CHART.defaultIsolineWidth,
			colorIsolinesByZ: TIN_CHART.defaultColorIsolinesByZ,
			isolineMinColor: TIN_CHART.defaultIsolineMinColor,
			isolineMaxColor: TIN_CHART.defaultIsolineMaxColor,
			showIsolineLabels: TIN_CHART.defaultShowIsolineLabels,
			isolineLabelSize: TIN_CHART.defaultIsolineLabelSize,
			isolineLabelColor: TIN_CHART.defaultIsolineLabelColor,
			showThreshold: TIN_CHART.defaultShowThreshold,
			thresholdValue: TIN_CHART.defaultThresholdValue,
			thresholdColor: TIN_CHART.defaultThresholdColor,
			thresholdWidth: TIN_CHART.defaultThresholdWidth,
			showXAxisLabel: true,
			showYAxisLabel: true,
		},
		scatter3d: {
			enabled: false,
			expanded: false,
			x: null,
			y: null,
			z: null,
			customTitle: '',
			chartHeight: 460,
			pointSize: SCATTER3D_CHART.defaultPointSize,
			opacity: SCATTER3D_CHART.defaultOpacity,
			color: CHART_COLORS.scatter3d,
		},
	};
}

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
 * @returns {import('../types.js').GlobalFilter}
 */
function pickGlobalFilter(config) {
	if (!config || typeof config !== 'object') {
		return createEmptyGlobalFilter();
	}
	return normalizeGlobalFilter(config.globalFilter);
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

	return {
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
}

/**
 * Bring a (possibly-partial or legacy) chart config to its canonical shape:
 * default-filled and legacy-migrated via {@link mergeChartConfigWithDefaults},
 * then stale global-filter rules trimmed against `columnNames`. Pure and
 * idempotent. "Canonical" here means object/default shape, legacy migration, and
 * stale-column filter cleanup; it does not validate scalar/enumerated values and
 * does not strip unknown top-level keys.
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
