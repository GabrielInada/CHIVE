/**
 * Line-chart renderer.
 *
 * Renders a 2-D line series with one of seven curve interpolations
 * (linear, monotone, step variants, basis, cardinal). Accepts numeric,
 * categorical, or date X-axes, date detection happens via the row's value
 * type. Missing-data handling: `missingMode` selects how gaps are drawn
 * (skip / connect / break).
 *
 * Internal D3 helpers (scale construction, curve resolution, tooltip
 * tracking) are intentionally undocumented per the Tier 5 plan.
 *
 * @typedef {import('../../../types.js').Result} Result
 */

import {
	axisBottom,
	axisLeft,
	curveBasis,
	curveCardinal,
	curveLinear,
	curveMonotoneX,
	curveStep,
	curveStepAfter,
	curveStepBefore,
	line as d3Line,
	max as d3Max,
	min as d3Min,
	scaleLinear,
} from '../../../../vendor/d3/d3.js';
import {
	createTooltipLine,
	hideChartTooltip,
	moveChartTooltip,
	showChartTooltip,
} from '../../shared/tooltip/tooltip.js';
import { CHART_DIMENSIONS, LINE_CHART } from '../../../config/charts.js';
import { formatNumber } from '../../../utils/formatters.js';
import { ok, fail } from '../../../utils/result.js';
import {
	appendAxisLabels,
	appendBottomAxis,
	appendLeftAxis,
	setupChartSvg,
} from '../../shared/svg/scaffold.js';
import {
	AXIS_KIND,
	resolveXAxisKind,
	buildPoints,
	aggregatePoints,
	sortByX,
	formatXValue,
} from '../data.js';
import { buildXScale } from '../scales.js';
import { normalizeLineOptions } from '../options.js';

const CURVE_BY_KEY = {
	linear: curveLinear,
	monotone: curveMonotoneX,
	step: curveStep,
	'step-before': curveStepBefore,
	'step-after': curveStepAfter,
	basis: curveBasis,
	cardinal: curveCardinal,
};

function truncateCategoryTick(value, maxLength = 18) {
	const text = String(value);
	if (text.length <= maxLength) return text;
	return `${text.slice(0, Math.max(1, maxLength - 1))}…`;
}

/**
 * Render a line chart into `container`. Returns `ok()` on success, or
 * `fail()` when required arguments are missing or the data resolves to
 * fewer than two finite points.
 *
 * Common option keys: `curve` (one of `LINE_CHART.curveOptions`), `missingMode`
 * ('skip' | 'connect' | 'break'), `aggregateMode` ('none' | 'mean' | 'sum'),
 * `sortX`, `showPoints`, `strokeWidth`, `color`, `ghostStrokeColor`,
 * axis-label toggles, `customTitle`, `chartHeight`, `locale`.
 *
 * @param {HTMLElement} container - Target DOM element. Existing contents are replaced.
 * @param {Array<Object<string, *>>} rows - Source rows.
 * @param {string} xColumn - X-axis column name (any type).
 * @param {string} yColumn - Y-axis column name (numeric).
 * @param {Object} [options={}] - Render options bag.
 * @returns {Result}
 */
export function renderLineChart(container, rows, xColumn, yColumn, options = {}) {
	if (!container || !xColumn || !yColumn) return fail('invalid-args');
	if (!Array.isArray(rows) || rows.length === 0) return fail();

	const xKind = resolveXAxisKind(options.axisTypes?.x);
	const curve = CURVE_BY_KEY[options.curve] || curveLinear;
	const {
		missingMode,
		strokeWidth,
		color,
		ghostColor,
		showPoints,
		sortX,
		aggregateMode,
		showXAxisLabel,
		showYAxisLabel,
		customTitle,
		chartHeight,
		axisLabels,
		locale,
	} = normalizeLineOptions(options, xColumn, yColumn);

	let points = buildPoints(rows, xColumn, yColumn, xKind);
	if (points.length === 0) return fail('no-x-values');

	points = aggregatePoints(points, aggregateMode);
	if (sortX) points = sortByX(points, xKind);

	const definedPoints = points.filter(p => Number.isFinite(p.y));
	if (definedPoints.length === 0) return fail('no-numeric');

	const width = Math.max(container.clientWidth || CHART_DIMENSIONS.line.width, 320);
	const height = chartHeight;
	const margin = { ...CHART_DIMENSIONS.line.margins };
	if (xKind === AXIS_KIND.categorical) {
		margin.bottom = Math.max(margin.bottom, 64);
	}
	const { group, innerWidth, innerHeight } = setupChartSvg(container, {
		width,
		height,
		margin,
		customTitle,
		viewBox: true,
		minInnerWidth: 40,
		minInnerHeight: 40,
	});
	hideChartTooltip();

	const xScale = buildXScale(xKind, definedPoints, [0, innerWidth]);
	const yValues = definedPoints.map(p => p.y);
	const yMin = Math.min(0, d3Min(yValues));
	const yMax = d3Max(yValues);
	const yDomain = yMin === yMax
		? [yMin - 1, yMax + 1]
		: [yMin, yMax];
	const yScale = scaleLinear().domain(yDomain).nice().range([innerHeight, 0]);

	const projectX = point => {
		if (xKind === AXIS_KIND.categorical) {
			const value = xScale(point.x);
			return value === undefined ? null : value;
		}
		return xScale(point.x);
	};
	const projectY = point => yScale(point.y);

	const lineGenerator = d3Line()
		.curve(curve)
		.x(point => projectX(point))
		.y(point => projectY(point));

	if (missingMode === 'interpolate') {
		const ghostGenerator = d3Line()
			.curve(curve)
			.defined(point => Number.isFinite(point.y) && projectX(point) !== null)
			.x(point => projectX(point))
			.y(point => projectY(point));
		group.append('path')
			.attr('class', 'line-path-ghost')
			.attr('fill', 'none')
			.attr('stroke', ghostColor)
			.attr('stroke-width', strokeWidth)
			.attr('stroke-dasharray', '4 3')
			.attr('d', ghostGenerator(definedPoints));
	}

	const pathPoints = missingMode === 'connect' ? definedPoints : points;
	const mainGenerator = missingMode === 'connect'
		? lineGenerator
		: d3Line()
			.curve(curve)
			.defined(point => Number.isFinite(point.y) && projectX(point) !== null)
			.x(point => projectX(point))
			.y(point => projectY(point));

	group.append('path')
		.attr('class', 'line-path-main')
		.attr('fill', 'none')
		.attr('stroke', color)
		.attr('stroke-width', strokeWidth)
		.attr('stroke-linejoin', 'round')
		.attr('stroke-linecap', 'round')
		.attr('d', mainGenerator(pathPoints));

	if (showPoints) {
		group.selectAll('circle.line-point')
			.data(definedPoints)
			.enter()
			.append('circle')
			.attr('class', 'line-point')
			.attr('cx', point => projectX(point))
			.attr('cy', point => projectY(point))
			.attr('r', LINE_CHART.pointRadius)
			.attr('fill', color)
			.on('mouseenter', (event, point) => {
				showChartTooltip(buildTooltipContent(point, axisLabels, xKind, locale), event.pageX, event.pageY);
			})
			.on('mousemove', event => moveChartTooltip(event.pageX, event.pageY))
			.on('mouseleave', () => hideChartTooltip());
	}

	appendBottomAxis(group, {
		axis: xKind === AXIS_KIND.date
			? axisBottom(xScale).ticks(Math.max(2, Math.round(innerWidth / 80))).tickSizeOuter(0)
			: xKind === AXIS_KIND.numeric
				? axisBottom(xScale).ticks(Math.max(2, Math.round(innerWidth / 80))).tickSizeOuter(0)
				: axisBottom(xScale).tickFormat(value => truncateCategoryTick(value)),
		innerHeight,
		tickRotation: xKind === AXIS_KIND.categorical
			? { angle: -28, dx: '-0.55em', dy: '0.2em' }
			: null,
	});

	appendLeftAxis(group, { axis: axisLeft(yScale).ticks(Math.max(2, Math.round(innerHeight / 40))) })
		.call(g => g.select('.domain').remove())
		.call(g => g.selectAll('.tick line').clone()
			.attr('x2', innerWidth)
			.attr('stroke-opacity', 0.1));

	appendAxisLabels(group, {
		innerWidth,
		innerHeight,
		marginLeft: margin.left,
		marginBottom: margin.bottom,
		axisLabels,
		showX: showXAxisLabel,
		showY: showYAxisLabel,
		xBottomInset: 8,
	});

	return ok();
}

function buildTooltipContent(point, axisLabels, xKind, locale) {
	const wrapper = document.createElement('div');
	wrapper.appendChild(createTooltipLine(axisLabels.x, formatXValue(point.x, xKind, locale)));
	wrapper.appendChild(createTooltipLine(axisLabels.y, formatNumber(point.y, locale)));
	return wrapper;
}
