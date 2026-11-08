/**
 * Scatter-plot renderer (orchestrator).
 *
 * Renders a 2-D scatter with optional categorical axes (jittered or
 * aggregated), log scaling, numeric size/color encoding, and an optional
 * OLS regression line + confidence band. The pipeline is split across peer
 * modules and wired together here: option normalization, point preparation,
 * scale + position accessors, size/color encoding, tooltip/filter
 * interactions, and the regression overlay. Scatter internals live in the
 * package root one level up; shared SVG/axis scaffolding lives in
 * {@link chartScaffold}.
 *
 * @typedef {import('../../../types.js').Result} Result
 */

import { axisBottom, axisLeft } from '../../../../vendor/d3/d3.js';
import { hideChartTooltip, hideHoverTooltip, moveChartTooltip } from '../../shared/tooltip/tooltip.js';
import { CHART_DIMENSIONS } from '../../../config/charts/definitions.js';
import { ok, fail } from '../../../utils/result.js';
import {
	AXIS_TYPE_VALUES,
	truncateCategoryTick,
	computeAdaptiveMargins,
} from '../axisHelpers.js';
import {
	appendAxisLabels,
	appendBottomAxis,
	appendLeftAxis,
	setupChartSvg,
} from '../../shared/svg/scaffold.js';
import {
	renderRegressionAnnotation,
	renderRegressionLayer,
} from '../regressionLayer.js';
import { normalizeScatterOptions } from '../options.js';
import { buildColorAccessor, buildRadiusAccessor } from '../encoding.js';
import { buildScatterPoints } from '../data.js';
import { buildScatterScales } from '../scales.js';
import { createScatterInteractions } from '../interaction.js';

/**
 * Render a scatter plot into `container`. Returns `ok()` on success, or
 * `fail()` when required arguments are missing or no points resolve.
 *
 * Common config keys: `xScale`/`yScale` ('linear' | 'log'), `radius`,
 * `opacity`, `sizeMode` ('uniform' | 'numeric'), `sizeField`,
 * `categoricalPairMode` ('jitter' | 'aggregate'), `colorField`,
 * `regression` (with `enabled`, `showCI`, `lineColor`, …),
 * axis-label toggles, palette/color inputs, `customTitle`, and `chartHeight`.
 * The separate context supplies locale,
 * localized labels, column types, filter callbacks and render-budget approval.
 *
 * @param {HTMLElement} container - Target DOM element. Existing contents are replaced.
 * @param {Array<Object<string, *>>} rows - Source rows.
 * @param {Object} config - Stored chart config, normalized once inside the renderer.
 * @param {Object} context - Localized labels, locale, and runtime callbacks from presentation.
 * @returns {Result}
 */
export function renderScatterPlot(container, rows, config = {}, context = {}) {
	const { x: xColumn, y: yColumn } = config;
	const { labels = {}, axisLabels = {}, axisTypes: configuredAxisTypes = {}, locale, filterCallbacks, allowFullRender = false } = context;
	if (!container || !xColumn || !yColumn) return fail();
	const {
		xScaleType,
		yScaleType,
		showXAxisLabel,
		showYAxisLabel,
		radius,
		opacity,
		sizeMode,
		sizeField,
		sizeMin,
		sizeMax,
		color,
		colorMode,
		colorField,
		gradientMinColor,
		gradientMaxColor,
		colorScheme,
		gradientDistribution,
		customTitle,
		chartHeight,
		categoricalPairMode,
	} = normalizeScatterOptions(config);

	const {
		points,
		renderedPoints,
		renderedCount,
		validCount,
		totalCount,
		sampled,
		axisTypes,
		effectiveXScaleType,
		effectiveYScaleType,
		shouldAggregateCategoricalPairs,
		categoryLabel,
	} = buildScatterPoints({
		rows,
		xColumn,
		yColumn,
		xScaleType,
		yScaleType,
		categoricalPairMode,
		configuredAxisTypes,
		renderAll: allowFullRender === true,
		missingLabel: labels.missing,
	});

	if (points.length === 0) {
		return fail(effectiveXScaleType === 'log' || effectiveYScaleType === 'log' ? 'log-no-positive' : undefined);
	}

	const width = Math.max(container.clientWidth || CHART_DIMENSIONS.scatter.width, 320);
	const height = chartHeight;
	const margin = computeAdaptiveMargins(CHART_DIMENSIONS.scatter.margins, points, axisTypes, categoryLabel);
	const { svg, group, innerWidth, innerHeight } = setupChartSvg(container, {
		width,
		height,
		margin,
		customTitle,
		minInnerWidth: 40,
		minInnerHeight: 40,
	});
	hideChartTooltip();

	const { showTooltip, togglePinnedTooltip } = createScatterInteractions({
		axisTypes,
		axisLabels,
		labels,
		locale,
		categoryLabel,
		filterCallbacks,
		xFilterColumn: xColumn,
		yFilterColumn: yColumn,
	});

	const { xScale, yScale, getPointX, getPointY } = buildScatterScales({
		points,
		axisTypes,
		effectiveXScaleType,
		effectiveYScaleType,
		innerWidth,
		innerHeight,
		shouldAggregateCategoricalPairs,
	});

	const getPointRadius = buildRadiusAccessor({
		points,
		sizeMode,
		sizeField,
		sizeMin,
		sizeMax,
		radius,
		shouldAggregateCategoricalPairs,
	});

	const { getPointColor, categoryMap, getCategoryColorValue } = buildColorAccessor({
		points,
		colorMode,
		colorField,
		color,
		gradientMinColor,
		gradientMaxColor,
		colorScheme,
		gradientDistribution,
	});

	const regressionRender = renderRegressionLayer({
		options: config,
		points,
		axisTypes,
		effectiveXScaleType,
		effectiveYScaleType,
		colorMode,
		colorField,
		categoryMap,
		getCategoryColorValue,
		categoryLabel,
		group,
		xScale,
		yScale,
		innerWidth,
		innerHeight,
		color,
		labels,
	});

	const pointLayer = group
		.append('g')
		.attr('class', 'scatter-points');

	pointLayer
		.selectAll('circle')
		.data(renderedPoints)
		.enter()
		.append('circle')
		.attr('class', 'scatter-point')
		.attr('cx', point => getPointX(point))
		.attr('cy', point => getPointY(point))
		.attr('r', point => getPointRadius(point))
		.attr('fill', point => getPointColor(point))
		.attr('opacity', opacity);

	const pointFromEvent = event => {
		const target = event.target;
		if (!(target instanceof window.SVGElement) || !target.matches('.scatter-point')) return null;
		return target.__data__ || null;
	};

	pointLayer
		.on('mouseover', event => {
			const point = pointFromEvent(event);
			if (!point) return;
			showTooltip(event, point);
		})
		.on('mousemove', event => {
			if (!pointFromEvent(event)) return;
			moveChartTooltip(event.pageX, event.pageY);
		})
		.on('mouseout', event => {
			if (!pointFromEvent(event)) return;
			hideHoverTooltip();
		})
		.on('click', event => {
			const point = pointFromEvent(event);
			if (!point) return;
			event.stopPropagation();
			togglePinnedTooltip(event, point);
		});

	svg.on('click', () => {
		hideChartTooltip();
	});

	appendBottomAxis(group, {
		axis: axisTypes.x === AXIS_TYPE_VALUES.numeric
			? axisBottom(xScale).ticks(8)
			: axisBottom(xScale).tickFormat(key => truncateCategoryTick(categoryLabel(key))),
		innerHeight,
		tickRotation: axisTypes.x === AXIS_TYPE_VALUES.categorical
			? { angle: -28, dx: '-0.55em', dy: '0.2em' }
			: null,
	});

	const yAxis = appendLeftAxis(group, {
		axis: axisTypes.y === AXIS_TYPE_VALUES.numeric
			? axisLeft(yScale).ticks(8)
			: axisLeft(yScale).tickFormat(key => categoryLabel(key)),
	});

	if (axisTypes.y === AXIS_TYPE_VALUES.categorical) {
		yAxis
			.selectAll('text')
			.style('font-size', '10px');
	}

	appendAxisLabels(group, {
		innerWidth,
		innerHeight,
		marginLeft: margin.left,
		marginBottom: margin.bottom,
		axisLabels,
		showX: showXAxisLabel,
		showY: showYAxisLabel,
		xBottomInset: 14,
	});

	if (regressionRender) {
		renderRegressionAnnotation({
			group,
			innerWidth,
			regressionRender,
			xScale: effectiveXScaleType,
			yScale: effectiveYScaleType,
		});
	}

	return ok({
		renderedCount,
		validCount,
		totalCount,
		sampled,
	});
}
