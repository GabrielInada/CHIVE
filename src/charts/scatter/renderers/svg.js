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
import { hideChartTooltip, moveChartTooltip } from '../../shared/tooltip/tooltip.js';
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
 * Common option keys: `xScale`/`yScale` ('linear' | 'log'), `radius`,
 * `opacity`, `sizeMode` ('uniform' | 'numeric'), `sizeField`,
 * `categoricalPairMode` ('jitter' | 'aggregate'), `colorField`,
 * `regressionEnabled` (with `showCIBand`, `regressionLineColor`, …),
 * axis-label toggles, palette/color inputs, `customTitle`, `chartHeight`,
 * `locale`.
 *
 * @param {HTMLElement} container - Target DOM element. Existing contents are replaced.
 * @param {Array<Object<string, *>>} rows - Source rows.
 * @param {string} xColumn - X-axis column name.
 * @param {string} yColumn - Y-axis column name.
 * @param {Object} [options={}] - Render options bag.
 * @returns {Result}
 */
export function renderScatterPlot(container, rows, xColumn, yColumn, options = {}) {
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
		labels,
		axisLabels,
		locale,
		configuredAxisTypes,
		xFilterColumn,
		yFilterColumn,
	} = normalizeScatterOptions(options, xColumn, yColumn);

	const {
		points,
		axisTypes,
		effectiveXScaleType,
		effectiveYScaleType,
		shouldAggregateCategoricalPairs,
	} = buildScatterPoints({
		rows,
		xColumn,
		yColumn,
		xScaleType,
		yScaleType,
		categoricalPairMode,
		configuredAxisTypes,
	});

	if (points.length === 0) {
		return fail(effectiveXScaleType === 'log' || effectiveYScaleType === 'log' ? 'log-no-positive' : undefined);
	}

	const width = Math.max(container.clientWidth || CHART_DIMENSIONS.scatter.width, 320);
	const height = chartHeight;
	const margin = computeAdaptiveMargins(CHART_DIMENSIONS.scatter.margins, points, axisTypes);
	const { svg, group, innerWidth, innerHeight } = setupChartSvg(container, {
		width,
		height,
		margin,
		customTitle,
		minInnerWidth: 40,
		minInnerHeight: 40,
	});
	hideChartTooltip();

	let pinnedIndex = null;
	const { showTooltip, showPinnedTooltip } = createScatterInteractions({
		axisTypes,
		axisLabels,
		labels,
		locale,
		filterCallbacks: options.filterCallbacks || {},
		xFilterColumn,
		yFilterColumn,
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
		options,
		points,
		axisTypes,
		effectiveXScaleType,
		effectiveYScaleType,
		colorMode,
		colorField,
		categoryMap,
		getCategoryColorValue,
		group,
		xScale,
		yScale,
		innerWidth,
		innerHeight,
		color,
		labels,
		isPinned: () => pinnedIndex !== null,
	});

	group
		.selectAll('circle')
		.data(points)
		.enter()
		.append('circle')
		.attr('cx', point => getPointX(point))
		.attr('cy', point => getPointY(point))
		.attr('r', point => getPointRadius(point))
		.attr('fill', point => getPointColor(point))
		.attr('opacity', opacity)
		.on('mouseenter', (event, point) => {
			if (pinnedIndex !== null) return;
			showTooltip(event, point);
		})
		.on('mousemove', event => {
			if (pinnedIndex !== null) return;
			moveChartTooltip(event.pageX, event.pageY);
		})
		.on('mouseleave', () => {
			if (pinnedIndex !== null) return;
			hideChartTooltip();
		})
		.on('click', (event, point) => {
			event.stopPropagation();
			if (pinnedIndex === point.index) {
				pinnedIndex = null;
				hideChartTooltip();
				return;
			}
			pinnedIndex = point.index;
			showPinnedTooltip(event, point, () => {
				pinnedIndex = null;
				hideChartTooltip();
			});
		});

	svg.on('click', () => {
		pinnedIndex = null;
		hideChartTooltip();
	});

	appendBottomAxis(group, {
		axis: axisTypes.x === AXIS_TYPE_VALUES.numeric
			? axisBottom(xScale).ticks(8)
			: axisBottom(xScale).tickFormat(value => truncateCategoryTick(value)),
		innerHeight,
		tickRotation: axisTypes.x === AXIS_TYPE_VALUES.categorical
			? { angle: -28, dx: '-0.55em', dy: '0.2em' }
			: null,
	});

	const yAxis = appendLeftAxis(group, {
		axis: axisTypes.y === AXIS_TYPE_VALUES.numeric
			? axisLeft(yScale).ticks(8)
			: axisLeft(yScale).tickFormat(value => String(value)),
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

	return ok();
}
