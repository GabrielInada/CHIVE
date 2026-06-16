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
 * @typedef {import('../../types.js').Result} Result
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
	extent,
	line as d3Line,
	max as d3Max,
	min as d3Min,
	scaleLinear,
	scalePoint,
	scaleUtc,
} from '../../../vendor/d3/d3.js';
import {
	createTooltipLine,
	hideChartTooltip,
	moveChartTooltip,
	showChartTooltip,
} from './tooltip.js';
import { CHART_COLORS, CHART_DIMENSIONS, LINE_CHART } from '../../config/charts.js';
import { formatDate, formatNumber, isNullish } from '../../utils/formatters.js';
import { compareStrings } from '../../utils/chartFilters.js';
import { isValidHexColor } from '../../utils/colorUtils.js';
import { ok, fail } from '../../utils/result.js';
import {
	appendAxisLabels,
	appendBottomAxis,
	appendLeftAxis,
	setupChartSvg,
} from './chartScaffold.js';

const CURVE_BY_KEY = {
	linear: curveLinear,
	monotone: curveMonotoneX,
	step: curveStep,
	'step-before': curveStepBefore,
	'step-after': curveStepAfter,
	basis: curveBasis,
	cardinal: curveCardinal,
};

const AXIS_KIND = { date: 'date', numeric: 'numeric', categorical: 'categorical' };

function resolveXAxisKind(configuredAxisType) {
	const value = String(configuredAxisType || '').toLowerCase();
	if (value === 'date') return AXIS_KIND.date;
	if (value === 'number' || value === 'numeric') return AXIS_KIND.numeric;
	return AXIS_KIND.categorical;
}

function toDateOrNull(value) {
	if (isNullish(value) || value === '') return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isFinite(date.getTime()) ? date : null;
}

function buildPoints(rows, xColumn, yColumn, xKind) {
	const points = [];
	for (let index = 0; index < rows.length; index++) {
		const row = rows[index];
		const xRaw = row?.[xColumn];
		const yRaw = row?.[yColumn];
		const yIsMissing = isNullish(yRaw) || yRaw === '';
		const yNum = yIsMissing ? NaN : Number(yRaw);
		const y = Number.isFinite(yNum) ? yNum : NaN;
		let x;
		if (xKind === AXIS_KIND.date) {
			x = toDateOrNull(xRaw);
		} else if (xKind === AXIS_KIND.numeric) {
			const xIsMissing = isNullish(xRaw) || xRaw === '';
			const n = xIsMissing ? NaN : Number(xRaw);
			x = Number.isFinite(n) ? n : null;
		} else {
			x = isNullish(xRaw) ? null : String(xRaw);
		}
		if (x === null || x === '') continue;
		points.push({ x, y, raw: row, index });
	}
	return points;
}

function aggregatePoints(points, mode) {
	if (mode === 'none') return points;
	const groups = new Map();
	for (const point of points) {
		const key = point.x instanceof Date ? point.x.getTime() : point.x;
		if (!groups.has(key)) groups.set(key, { x: point.x, ys: [], raw: point.raw, index: point.index });
		const group = groups.get(key);
		if (Number.isFinite(point.y)) group.ys.push(point.y);
	}
	const out = [];
	for (const group of groups.values()) {
		let y;
		if (mode === 'count') {
			y = group.ys.length;
		} else if (mode === 'sum') {
			y = group.ys.reduce((acc, v) => acc + v, 0);
		} else if (mode === 'mean') {
			y = group.ys.length ? group.ys.reduce((acc, v) => acc + v, 0) / group.ys.length : NaN;
		} else {
			y = group.ys[0];
		}
		out.push({ x: group.x, y, raw: group.raw, index: group.index });
	}
	return out;
}

function sortByX(points, xKind) {
	const cloned = points.slice();
	cloned.sort((a, b) => {
		if (xKind === AXIS_KIND.date) return a.x.getTime() - b.x.getTime();
		if (xKind === AXIS_KIND.numeric) return a.x - b.x;
		return compareStrings(a.x, b.x);
	});
	return cloned;
}

function buildXScale(xKind, points, range) {
	if (xKind === AXIS_KIND.date) {
		return scaleUtc().domain(extent(points, p => p.x)).range(range);
	}
	if (xKind === AXIS_KIND.numeric) {
		const [xMin, xMax] = extent(points, p => p.x);
		const domain = xMin === xMax
			? [xMin - 1, xMax + 1]
			: [xMin, xMax];
		return scaleLinear().domain(domain).range(range);
	}
	const domain = [];
	const seen = new Set();
	for (const point of points) {
		const value = point.x;
		if (seen.has(value)) continue;
		seen.add(value);
		domain.push(value);
	}
	return scalePoint().domain(domain).range(range).padding(0.5);
}

function formatXValue(value, xKind, locale) {
	if (xKind === AXIS_KIND.date) return formatDate(value, locale);
	if (xKind === AXIS_KIND.numeric) return formatNumber(value, locale);
	return String(value ?? '');
}

function truncateCategoryTick(value, maxLength = 18) {
	const text = String(value);
	if (text.length <= maxLength) return text;
	return `${text.slice(0, Math.max(1, maxLength - 1))}…`;
}

function normalizeHex(value, fallback) {
	const trimmed = String(value || '').trim();
	return isValidHexColor(trimmed) ? trimmed : fallback;
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
	const missingMode = LINE_CHART.missingModes.includes(options.missingMode)
		? options.missingMode
		: LINE_CHART.defaultMissingMode;
	const strokeWidth = Number.isFinite(Number(options.strokeWidth))
		? Math.max(0.5, Math.min(8, Number(options.strokeWidth)))
		: LINE_CHART.defaultStrokeWidth;
	const color = normalizeHex(options.color, CHART_COLORS.line);
	const ghostColor = normalizeHex(options.ghostStrokeColor, LINE_CHART.defaultGhostStrokeColor);
	const showPoints = options.showPoints === true;
	const sortX = options.sortX !== false;
	const aggregateMode = LINE_CHART.aggregateModes.includes(options.aggregateMode)
		? options.aggregateMode
		: 'none';
	const showXAxisLabel = options.showXAxisLabel !== false;
	const showYAxisLabel = options.showYAxisLabel !== false;
	const customTitle = String(options.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(options.chartHeight))
		? Math.max(220, Math.min(720, Number(options.chartHeight)))
		: CHART_DIMENSIONS.line.height;
	const axisLabels = {
		x: options.axisLabels?.x || xColumn,
		y: options.axisLabels?.y || yColumn,
	};
	const locale = options.locale || undefined;

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
