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
	select,
} from 'd3';
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
	if (value === 'data' || value === 'date') return AXIS_KIND.date;
	if (value === 'numero' || value === 'number' || value === 'numeric') return AXIS_KIND.numeric;
	return AXIS_KIND.categorical;
}

function toDateOrNull(value) {
	if (isNullish(value) || value === '') return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isFinite(date.getTime()) ? date : null;
}

function buildPoints(dados, eixoX, eixoY, xKind) {
	const points = [];
	for (let index = 0; index < dados.length; index++) {
		const row = dados[index];
		const xRaw = row?.[eixoX];
		const yRaw = row?.[eixoY];
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

export function renderLineChart(container, dados, eixoX, eixoY, opcoes = {}) {
	if (!container || !eixoX || !eixoY) return fail('invalid-args');
	if (!Array.isArray(dados) || dados.length === 0) return fail();

	const xKind = resolveXAxisKind(opcoes.axisTypes?.x);
	const curve = CURVE_BY_KEY[opcoes.curve] || curveLinear;
	const missingMode = LINE_CHART.missingModes.includes(opcoes.missingMode)
		? opcoes.missingMode
		: LINE_CHART.defaultMissingMode;
	const strokeWidth = Number.isFinite(Number(opcoes.strokeWidth))
		? Math.max(0.5, Math.min(8, Number(opcoes.strokeWidth)))
		: LINE_CHART.defaultStrokeWidth;
	const color = normalizeHex(opcoes.color, CHART_COLORS.line);
	const ghostColor = normalizeHex(opcoes.ghostStrokeColor, LINE_CHART.defaultGhostStrokeColor);
	const showPoints = opcoes.showPoints === true;
	const sortX = opcoes.sortX !== false;
	const aggregateMode = LINE_CHART.aggregateModes.includes(opcoes.aggregateMode)
		? opcoes.aggregateMode
		: 'none';
	const showXAxisLabel = opcoes.showXAxisLabel !== false;
	const showYAxisLabel = opcoes.showYAxisLabel !== false;
	const customTitle = String(opcoes.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(opcoes.chartHeight))
		? Math.max(220, Math.min(720, Number(opcoes.chartHeight)))
		: CHART_DIMENSIONS.line.height;
	const axisLabels = {
		x: opcoes.axisLabels?.x || eixoX,
		y: opcoes.axisLabels?.y || eixoY,
	};
	const locale = opcoes.locale || undefined;

	let points = buildPoints(dados, eixoX, eixoY, xKind);
	if (points.length === 0) return fail('no-x-values');

	points = aggregatePoints(points, aggregateMode);
	if (sortX) points = sortByX(points, xKind);

	const definedPoints = points.filter(p => Number.isFinite(p.y));
	if (definedPoints.length === 0) return fail('no-numeric');

	container.replaceChildren();
	hideChartTooltip();

	const largura = Math.max(container.clientWidth || CHART_DIMENSIONS.line.width, 320);
	const altura = chartHeight;
	const margem = { ...CHART_DIMENSIONS.line.margins };
	if (xKind === AXIS_KIND.categorical) {
		margem.bottom = Math.max(margem.bottom, 64);
	}
	const titleOffset = customTitle ? 20 : 0;
	const larguraInterna = Math.max(40, largura - margem.left - margem.right);
	const alturaInterna = Math.max(40, altura - margem.top - margem.bottom - titleOffset);

	const svg = select(container)
		.append('svg')
		.attr('width', largura)
		.attr('height', altura)
		.attr('viewBox', `0 0 ${largura} ${altura}`);

	if (customTitle) {
		svg.append('text')
			.attr('x', largura / 2)
			.attr('y', 16)
			.attr('text-anchor', 'middle')
			.attr('font-size', 13)
			.attr('font-weight', 600)
			.attr('fill', '#3f3a33')
			.text(customTitle);
	}

	const grupo = svg.append('g')
		.attr('transform', `translate(${margem.left},${margem.top + titleOffset})`);

	const escalaX = buildXScale(xKind, definedPoints, [0, larguraInterna]);
	const yValues = definedPoints.map(p => p.y);
	const yMin = Math.min(0, d3Min(yValues));
	const yMax = d3Max(yValues);
	const yDomain = yMin === yMax
		? [yMin - 1, yMax + 1]
		: [yMin, yMax];
	const escalaY = scaleLinear().domain(yDomain).nice().range([alturaInterna, 0]);

	const projectX = point => {
		if (xKind === AXIS_KIND.categorical) {
			const value = escalaX(point.x);
			return value === undefined ? null : value;
		}
		return escalaX(point.x);
	};
	const projectY = point => escalaY(point.y);

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
		grupo.append('path')
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

	grupo.append('path')
		.attr('class', 'line-path-main')
		.attr('fill', 'none')
		.attr('stroke', color)
		.attr('stroke-width', strokeWidth)
		.attr('stroke-linejoin', 'round')
		.attr('stroke-linecap', 'round')
		.attr('d', mainGenerator(pathPoints));

	if (showPoints) {
		grupo.selectAll('circle.line-point')
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

	const xAxis = grupo.append('g')
		.attr('transform', `translate(0,${alturaInterna})`)
		.call(
			xKind === AXIS_KIND.date
				? axisBottom(escalaX).ticks(Math.max(2, Math.round(larguraInterna / 80))).tickSizeOuter(0)
				: xKind === AXIS_KIND.numeric
					? axisBottom(escalaX).ticks(Math.max(2, Math.round(larguraInterna / 80))).tickSizeOuter(0)
					: axisBottom(escalaX).tickFormat(value => truncateCategoryTick(value))
		);

	if (xKind === AXIS_KIND.categorical) {
		xAxis.selectAll('text')
			.style('text-anchor', 'end')
			.attr('dx', '-0.55em')
			.attr('dy', '0.2em')
			.attr('transform', 'rotate(-28)');
	}

	grupo.append('g')
		.call(axisLeft(escalaY).ticks(Math.max(2, Math.round(alturaInterna / 40))))
		.call(g => g.select('.domain').remove())
		.call(g => g.selectAll('.tick line').clone()
			.attr('x2', larguraInterna)
			.attr('stroke-opacity', 0.1));

	if (showXAxisLabel) {
		grupo.append('text')
			.attr('x', larguraInterna / 2)
			.attr('y', alturaInterna + margem.bottom - 8)
			.attr('text-anchor', 'middle')
			.attr('fill', '#5f5a53')
			.attr('font-size', 11)
			.text(axisLabels.x);
	}

	if (showYAxisLabel) {
		grupo.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -alturaInterna / 2)
			.attr('y', -margem.left + 16)
			.attr('text-anchor', 'middle')
			.attr('fill', '#5f5a53')
			.attr('font-size', 11)
			.text(axisLabels.y);
	}

	return ok();
}

function buildTooltipContent(point, axisLabels, xKind, locale) {
	const wrapper = document.createElement('div');
	wrapper.appendChild(createTooltipLine(axisLabels.x, formatXValue(point.x, xKind, locale)));
	wrapper.appendChild(createTooltipLine(axisLabels.y, formatNumber(point.y, locale)));
	return wrapper;
}
