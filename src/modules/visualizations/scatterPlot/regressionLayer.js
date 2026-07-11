/**
 * Scatter-plot regression render layer.
 *
 * Draws the optional OLS regression overlay (confidence band, dashed fit
 * line, hover tooltip) and the corner equation/R² annotation. The
 * regression math lives in {@link regression}; this module only
 * turns fit results into SVG. Used by `scatterPlot.js`.
 *
 * Internal helpers are intentionally undocumented per the Tier 5 plan.
 */

import { area as d3area, line as d3line } from '../../../../vendor/d3/d3.js';
import {
	createTooltipLine,
	hideChartTooltip,
	moveChartTooltip,
	showChartTooltip,
} from '../../../charts/shared/tooltip/tooltip.js';
import {
	computeRegression,
	formatRegressionEquation,
	formatR2,
} from './regression.js';
import { AXIS_TYPE_VALUES } from './axisHelpers.js';
import { isValidHexColor } from '../../../utils/colorUtils.js';

let scatterClipIdCounter = 0;

/**
 * Render the regression band + line layer (behind the points). Returns the
 * computed results bundle for the annotation pass, or `null` when no fit is
 * drawn.
 *
 * @param {Object} params - Wiring bag from `renderScatterPlot`.
 * @returns {?{ results: Array<Object>, mode: string, config: Object }}
 */
export function renderRegressionLayer({
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
	labels,
	isPinned,
}) {
	const config = options.regression;
	if (!config || config.enabled !== true) return null;
	if (axisTypes.x !== AXIS_TYPE_VALUES.numeric || axisTypes.y !== AXIS_TYPE_VALUES.numeric) return null;
	if (points.length < 2) return null;

	const perCategoryRequested = config.mode === 'perCategory';
	const canDoPerCategory = perCategoryRequested
		&& colorMode === 'category'
		&& !!colorField
		&& typeof getCategoryColorValue === 'function'
		&& categoryMap instanceof Map;
	const effectiveMode = canDoPerCategory ? 'perCategory' : 'overall';

	const groupBy = effectiveMode === 'perCategory' ? getCategoryColorValue : null;
	const xDomain = xScale.domain();

	const results = computeRegression({
		points,
		xScale: effectiveXScaleType,
		yScale: effectiveYScaleType,
		xDomain,
		groupBy,
	}).filter(r => r.fit && r.fit.ok && Array.isArray(r.sampleLine));

	if (results.length === 0) return null;

	const showCI = config.showCI !== false;
	const showLine = config.showLine !== false;
	const lineWidth = Number.isFinite(Number(config.lineWidth)) ? Number(config.lineWidth) : 2;
	const lineOpacity = Number.isFinite(Number(config.lineOpacity)) ? Number(config.lineOpacity) : 0.9;
	const bandOpacity = Number.isFinite(Number(config.bandOpacity)) ? Number(config.bandOpacity) : 0.18;
	const configuredOverallColor = String(config.overallColor || '').trim();
	const overallColor = isValidHexColor(configuredOverallColor)
		? configuredOverallColor
		: '#3f3a33';

	const clipId = `scatter-clip-${++scatterClipIdCounter}`;
	let defs = group.select('defs');
	if (defs.empty()) defs = group.append('defs');
	defs.append('clipPath')
		.attr('id', clipId)
		.append('rect')
		.attr('x', 0)
		.attr('y', 0)
		.attr('width', innerWidth)
		.attr('height', innerHeight);

	const yDomain = yScale.domain();
	const yLog = effectiveYScaleType === 'log';
	const yClampLow = yLog ? Math.max(yDomain[0] * 1e-6, Number.MIN_VALUE) : null;
	const clampY = value => {
		if (!yLog) return value;
		if (!Number.isFinite(value) || value <= 0) return yClampLow;
		return Math.max(value, yClampLow);
	};

	const layer = group.append('g')
		.attr('class', 'scatter-regression-layer')
		.attr('clip-path', `url(#${clipId})`);

	const lineGenerator = d3line()
		.x(d => xScale(d.x))
		.y(d => yScale(d.y));

	const areaGenerator = d3area()
		.x(d => xScale(d.x))
		.y0(d => yScale(clampY(d.yLow)))
		.y1(d => yScale(clampY(d.yHigh)));

	const resultsWithColor = results.map(r => {
		const groupColor = effectiveMode === 'perCategory'
			? (categoryMap && categoryMap.get(r.groupKey)) || overallColor
			: overallColor;
		return { ...r, groupColor };
	});

	if (showCI) {
		layer.selectAll('path.scatter-regression-band')
			.data(resultsWithColor.filter(r => Array.isArray(r.sampleBand)))
			.enter()
			.append('path')
			.attr('class', 'scatter-regression-band')
			.attr('d', d => areaGenerator(d.sampleBand))
			.attr('fill', d => d.groupColor)
			.attr('fill-opacity', bandOpacity)
			.attr('stroke', 'none')
			.attr('pointer-events', 'none');
	}

	if (showLine) {
		const lineSelection = layer.selectAll('path.scatter-regression-line')
			.data(resultsWithColor)
			.enter()
			.append('path')
			.attr('class', 'scatter-regression-line')
			.attr('d', d => lineGenerator(d.sampleLine))
			.attr('stroke', d => d.groupColor)
			.attr('stroke-width', lineWidth)
			.attr('stroke-opacity', lineOpacity)
			.attr('stroke-dasharray', '5,4')
			.attr('fill', 'none')
			.style('cursor', 'default')
			.style('pointer-events', 'stroke');

		lineSelection
			.on('mouseenter', (event, d) => {
				if (isPinned()) return;
				showRegressionTooltip(event, d, effectiveMode, labels);
			})
			.on('mousemove', event => {
				if (isPinned()) return;
				moveChartTooltip(event.pageX, event.pageY);
			})
			.on('mouseleave', () => {
				if (isPinned()) return;
				hideChartTooltip();
			});
	}

	return { results: resultsWithColor, mode: effectiveMode, config };
}

function showRegressionTooltip(event, regressionResult, mode, labels) {
	const lines = document.createDocumentFragment();
	if (mode === 'perCategory') {
		lines.appendChild(createTooltipLine(labels.regressionGroup, String(regressionResult.groupKey)));
	}
	const { slope, intercept, r2, n } = regressionResult.fit;
	lines.appendChild(createTooltipLine(labels.regressionSlope, formatRegressionNumber(slope)));
	lines.appendChild(createTooltipLine(labels.regressionIntercept, formatRegressionNumber(intercept)));
	lines.appendChild(createTooltipLine(labels.regressionR2, formatR2(r2)));
	lines.appendChild(createTooltipLine(labels.regressionN, String(n)));
	showChartTooltip(lines, event.pageX, event.pageY);
}

function formatRegressionNumber(value) {
	if (!Number.isFinite(value)) return 'NaN';
	const abs = Math.abs(value);
	if (abs === 0) return '0';
	if (abs >= 10000 || abs < 0.001) return value.toExponential(2);
	return Number(value.toPrecision(4)).toString();
}

/**
 * Draw the overall-mode equation + R² annotation in the top-right corner.
 * No-op for per-category mode or when both annotation parts are hidden.
 *
 * @param {Object} params - Wiring bag from `renderScatterPlot`.
 * @returns {void}
 */
export function renderRegressionAnnotation({ group, innerWidth, regressionRender, xScale, yScale }) {
	const { results, mode, config } = regressionRender;
	if (mode !== 'overall') return;
	if (results.length === 0) return;
	const showEquation = config.showEquation !== false;
	const showR2 = config.showR2 !== false;
	if (!showEquation && !showR2) return;
	const overall = results[0];
	const { slope, intercept, r2 } = overall.fit;

	const annotation = group.append('g').attr('class', 'scatter-regression-annotation');
	let yOffset = 12;
	if (showEquation) {
		annotation.append('text')
			.attr('x', innerWidth - 6)
			.attr('y', yOffset)
			.attr('text-anchor', 'end')
			.attr('font-size', 11)
			.attr('fill', '#3f3a33')
			.text(formatRegressionEquation({ slope, intercept, xScale, yScale }));
		yOffset += 14;
	}
	if (showR2) {
		annotation.append('text')
			.attr('x', innerWidth - 6)
			.attr('y', yOffset)
			.attr('text-anchor', 'end')
			.attr('font-size', 11)
			.attr('fill', '#5f5a53')
			.text(`R² = ${formatR2(r2)}`);
	}
}
