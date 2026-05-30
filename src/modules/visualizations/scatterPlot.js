/**
 * Scatter-plot renderer.
 *
 * Renders a 2-D scatter with optional categorical axes (jittered or
 * aggregated), log scaling, numeric size/color encoding, and an optional
 * OLS regression line + confidence band. Axis-type detection is delegated
 * to {@link scatterPlotAxisHelpers}; regression math to
 * {@link scatterPlotRegression}.
 *
 * Internal D3 helpers (scale construction, point rendering, regression
 * overlay) are intentionally undocumented per the Tier 5 plan.
 *
 * @typedef {import('../../types.js').Result} Result
 */

import { area as d3area, axisBottom, axisLeft, extent, line as d3line, scaleLinear, scaleLog, scalePoint, scaleSqrt, select } from 'https://esm.sh/d3@7.9.0';
import {
	buildCategoricalFilterActions,
	createFilterStateBadge,
	createTooltipActionGroup,
	createTooltipLine,
	hideChartTooltip,
	moveChartTooltip,
	showChartTooltip,
	showPinnedChartTooltip,
} from './tooltip.js';
import { toCategoryToken, normalizeCategoryValue } from '../../utils/chartFilters.js';
import { SCATTER_PLOT, CHART_DIMENSIONS, CHART_COLORS } from '../../config/charts.js';
import { formatNumber, isNullish } from '../../utils/formatters.js';
import { interpolateColor, buildRankMap, isValidHexColor } from '../../utils/colorUtils.js';
import { ok, fail } from '../../utils/result.js';
import {
	AXIS_TYPE_VALUES,
	inferAxisType,
	buildCategoryDomain,
	buildCategoryJitterScale,
	truncateCategoryTick,
	computeAdaptiveMargins,
	aggregateCategoricalPairs,
	pickMostFrequentCategory,
	normalizeDomain,
} from './scatterPlotAxisHelpers.js';
import {
	computeRegression,
	formatRegressionEquation,
	formatR2,
} from './scatterPlotRegression.js';

let scatterClipIdCounter = 0;

const SCATTER_PALETTES = {
	Pastel: ['#FFB3BA', '#FFCCCB', '#FFFFBA', '#BAE1BA', '#BAC7FF', '#E0BBE4', '#FFDFD3', '#DFF8EB'],
	Bold: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'],
	'Colorblind-Safe': ['#0173B2', '#029E73', '#ECE133', '#CC78BC', '#CA9161', '#949494', '#ECE2F0', '#A6ACAF'],
};

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
	const xScaleType = options.xScale === 'log' ? 'log' : 'linear';
	const yScaleType = options.yScale === 'log' ? 'log' : 'linear';
	const showXAxisLabel = options.showXAxisLabel !== false;
	const showYAxisLabel = options.showYAxisLabel !== false;
	const radius = Number.isFinite(Number(options.radius)) ? Number(options.radius) : SCATTER_PLOT.defaultRadius;
	const opacity = Number.isFinite(Number(options.opacity)) ? Number(options.opacity) : SCATTER_PLOT.defaultOpacity;
	const sizeMode = options.sizeMode === 'numeric' ? 'numeric' : 'uniform';
	const sizeField = options.sizeField || null;
	const sizeMin = Number.isFinite(Number(options.sizeMin)) ? Math.max(0.5, Number(options.sizeMin)) : 2;
	const sizeMax = Number.isFinite(Number(options.sizeMax)) ? Math.max(sizeMin, Number(options.sizeMax)) : 12;
	const color = isValidHexColor(String(options.color || '').trim())
		? String(options.color).trim()
		: CHART_COLORS.scatter;
	const colorMode = ['uniform', 'numeric', 'category'].includes(options.colorMode)
		? options.colorMode
		: 'uniform';
	const colorField = options.colorField || null;
	const gradientMinColor = isValidHexColor(String(options.gradientMinColor || '').trim())
		? String(options.gradientMinColor).trim()
		: color;
	const gradientMaxColor = isValidHexColor(String(options.gradientMaxColor || '').trim())
		? String(options.gradientMaxColor).trim()
		: '#ffffff';
	const colorScheme = SCATTER_PALETTES[options.colorScheme] ? options.colorScheme : 'Bold';
	const gradientDistribution = options.gradientDistribution === 'rank' ? 'rank' : 'value';
	const customTitle = String(options.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(options.chartHeight))
		? Math.max(220, Math.min(720, Number(options.chartHeight)))
		: CHART_DIMENSIONS.scatter.height;
	const categoricalPairMode = options.categoricalPairMode === 'aggregate' ? 'aggregate' : 'jitter';
 	const labels = {
		xAxis: options.labels?.xAxis || 'X',
		yAxis: options.labels?.yAxis || 'Y',
		index: options.labels?.index || 'Index',
		count: options.labels?.count || 'Count',
		regressionSlope: options.labels?.regressionSlope || 'Slope',
		regressionIntercept: options.labels?.regressionIntercept || 'Intercept',
		regressionR2: options.labels?.regressionR2 || 'R²',
		regressionN: options.labels?.regressionN || 'Points',
		regressionGroup: options.labels?.regressionGroup || 'Group',
	};
	const axisLabels = {
		x: options.axisLabels?.x || xColumn,
		y: options.axisLabels?.y || yColumn,
	};
	const locale = options.locale || undefined;
	const configuredAxisTypes = {
		x: options.axisTypes?.x,
		y: options.axisTypes?.y,
	};

	let points = rows.map((row, index) => ({
		xRaw: row?.[xColumn],
		yRaw: row?.[yColumn],
		x: Number(row?.[xColumn]),
		y: Number(row?.[yColumn]),
		xCategory: normalizeCategoryValue(row?.[xColumn]),
		yCategory: normalizeCategoryValue(row?.[yColumn]),
		index,
		raw: row,
	}));

	const axisTypes = {
		x: inferAxisType(points.map(point => point.xRaw), configuredAxisTypes.x),
		y: inferAxisType(points.map(point => point.yRaw), configuredAxisTypes.y),
	};

	const effectiveXScaleType = axisTypes.x === AXIS_TYPE_VALUES.numeric
		? xScaleType
		: 'linear';
	const effectiveYScaleType = axisTypes.y === AXIS_TYPE_VALUES.numeric
		? yScaleType
		: 'linear';

	points = points.filter(point => {
		if (axisTypes.x === AXIS_TYPE_VALUES.numeric && !Number.isFinite(point.x)) return false;
		if (axisTypes.y === AXIS_TYPE_VALUES.numeric && !Number.isFinite(point.y)) return false;
		return true;
	});

	if (effectiveXScaleType === 'log') {
		points = points.filter(point => point.x > 0);
	}

	if (effectiveYScaleType === 'log') {
		points = points.filter(point => point.y > 0);
	}

	const shouldAggregateCategoricalPairs = (
		axisTypes.x === AXIS_TYPE_VALUES.categorical
		&& axisTypes.y === AXIS_TYPE_VALUES.categorical
		&& categoricalPairMode === 'aggregate'
	);

	if (shouldAggregateCategoricalPairs) {
		points = aggregateCategoricalPairs(points);
	}

	if (points.length === 0) {
		return fail(effectiveXScaleType === 'log' || effectiveYScaleType === 'log' ? 'log-no-positive' : undefined);
	}

	container.replaceChildren();
	hideChartTooltip();
	const width = Math.max(container.clientWidth || CHART_DIMENSIONS.scatter.width, 320);
	const height = chartHeight;
	const margin = computeAdaptiveMargins(CHART_DIMENSIONS.scatter.margins, points, axisTypes);
	const titleOffset = customTitle ? 20 : 0;
	const innerWidth = Math.max(40, width - margin.left - margin.right);
	const innerHeight = Math.max(40, height - margin.top - margin.bottom - titleOffset);

	const svg = select(container)
		.append('svg')
		.attr('width', width)
		.attr('height', height);

	const group = svg
		.append('g')
		.attr('transform', `translate(${margin.left},${margin.top + titleOffset})`);

	if (customTitle) {
		svg
			.append('text')
			.attr('x', width / 2)
			.attr('y', 16)
			.attr('text-anchor', 'middle')
			.attr('font-size', 13)
			.attr('font-weight', 600)
			.attr('fill', '#3f3a33')
			.text(customTitle);
	}

	let pinnedIndex = null;
	const filterCallbacks = options.filterCallbacks || {};
	const filterLabels = filterCallbacks.filterActionLabels || {};
	const xFilterColumn = typeof options.xColumn === 'string' ? options.xColumn : null;
	const yFilterColumn = typeof options.yColumn === 'string' ? options.yColumn : null;
	const actionLabels = {
		focus: filterLabels.focus || 'Show only this',
		add: filterLabels.add || 'Add to filter',
		exclude: filterLabels.exclude || 'Hide this',
		remove: filterLabels.remove || 'Remove from filter',
		bringBack: filterLabels.bringBack || 'Bring back',
	};

	const buildTooltipContent = point => {
		const wrapper = document.createElement('div');

		const xValue = axisTypes.x === AXIS_TYPE_VALUES.numeric
			? formatNumber(point.x, locale)
			: point.xCategory;
		const yValue = axisTypes.y === AXIS_TYPE_VALUES.numeric
			? formatNumber(point.y, locale)
			: point.yCategory;

		wrapper.appendChild(createTooltipLine(axisLabels.x, xValue));
		wrapper.appendChild(createTooltipLine(axisLabels.y, yValue));
		if (point.isAggregate) {
			wrapper.appendChild(createTooltipLine(labels.count, formatNumber(point.count, locale)));
		} else {
			wrapper.appendChild(createTooltipLine(labels.index, formatNumber(point.index + 1, locale)));
		}

		return wrapper;
	};

	const showTooltip = (event, point) => {
		showChartTooltip(buildTooltipContent(point), event.pageX, event.pageY);
	};

	const buildAxisActionSet = (column, rawValue, headingLabel) => {
		if (!column || isNullish(rawValue) || rawValue === '') return null;
		const token = toCategoryToken(rawValue);
		const state = typeof filterCallbacks.getTokenFilterState === 'function'
			? filterCallbacks.getTokenFilterState(column, token)
			: null;
		const omitFocus = typeof filterCallbacks.isShowOnlyThisRedundant === 'function'
			? !!filterCallbacks.isShowOnlyThisRedundant(column, token)
			: false;
		const actions = buildCategoricalFilterActions({
			column,
			token,
			state,
			labels: actionLabels,
			omitFocus,
			onFocus: filterCallbacks.onFocusGlobalFilter,
			onAdd: filterCallbacks.onAddToGlobalFilter,
			onExclude: filterCallbacks.onExcludeGlobalFilter,
			onRemove: filterCallbacks.onRemoveFromGlobalFilter,
			onBringBack: filterCallbacks.onBringBackGlobalFilter,
		});
		if (actions.length === 0) return null;
		const wrap = document.createElement('div');
		wrap.className = 'chart-tooltip__action-set-wrap';
		if (headingLabel) {
			const heading = document.createElement('div');
			heading.className = 'chart-tooltip__action-set-label';
			heading.textContent = headingLabel;
			wrap.appendChild(heading);
		}
		wrap.appendChild(createTooltipActionGroup(actions));
		return { node: wrap, state };
	};

	const showPinnedTooltip = (event, point, onDismiss) => {
		const content = buildTooltipContent(point);
		const actionSets = [];
		let primaryState = null;
		let primaryColumn = null;
		let primaryToken = null;

		if (axisTypes.x === AXIS_TYPE_VALUES.categorical && xFilterColumn) {
			const xResult = buildAxisActionSet(xFilterColumn, point.xCategory, `${axisLabels.x}`);
			if (xResult) {
				actionSets.push(xResult.node);
				primaryState = xResult.state;
				primaryColumn = xFilterColumn;
				primaryToken = toCategoryToken(point.xCategory);
			}
		}
		if (axisTypes.y === AXIS_TYPE_VALUES.categorical && yFilterColumn) {
			const yResult = buildAxisActionSet(yFilterColumn, point.yCategory, `${axisLabels.y}`);
			if (yResult) {
				actionSets.push(yResult.node);
				if (!primaryState) {
					primaryState = yResult.state;
					primaryColumn = yFilterColumn;
					primaryToken = toCategoryToken(point.yCategory);
				}
			}
		}

		const stateBadge = actionSets.length === 1 && primaryState
			? createFilterStateBadge({
				state: primaryState,
				includedLabel: filterLabels.stateIncluded,
				excludedLabel: filterLabels.stateExcluded,
			})
			: null;

		const headerTitle = axisTypes.x === AXIS_TYPE_VALUES.categorical
			? String(point.xCategory ?? '')
			: axisTypes.y === AXIS_TYPE_VALUES.categorical
				? String(point.yCategory ?? '')
				: '';

		showPinnedChartTooltip(content, event.pageX, event.pageY, {
			headerTitle,
			closeLabel: filterLabels.close,
			onDismiss,
			actionSets,
			stateBadge,
		});
		// Reference primaryColumn/primaryToken to silence unused-var warnings; they document
		// the per-axis context for future enhancements.
		void primaryColumn;
		void primaryToken;
	};

	let xScale;
	if (axisTypes.x === AXIS_TYPE_VALUES.numeric) {
		const xDomain = normalizeDomain(extent(points, point => point.x));
		xScale = (effectiveXScaleType === 'log' ? scaleLog() : scaleLinear())
			.domain(xDomain)
			.nice()
			.range([0, innerWidth]);
	} else {
		xScale = scalePoint()
			.domain(buildCategoryDomain(points, 'xCategory'))
			.range([0, innerWidth])
			.padding(0.5);
	}

	let yScale;
	if (axisTypes.y === AXIS_TYPE_VALUES.numeric) {
		const yDomain = normalizeDomain(extent(points, point => point.y));
		yScale = (effectiveYScaleType === 'log' ? scaleLog() : scaleLinear())
			.domain(yDomain)
			.nice()
			.range([innerHeight, 0]);
	} else {
		yScale = scalePoint()
			.domain(buildCategoryDomain(points, 'yCategory'))
			.range([innerHeight, 0])
			.padding(0.5);
	}

	const xJitterFor = axisTypes.x === AXIS_TYPE_VALUES.categorical && !shouldAggregateCategoricalPairs
		? buildCategoryJitterScale(xScale)
		: () => 0;
	const yJitterFor = axisTypes.y === AXIS_TYPE_VALUES.categorical && !shouldAggregateCategoricalPairs
		? buildCategoryJitterScale(yScale)
		: () => 0;

	const getPointX = point => {
		if (axisTypes.x === AXIS_TYPE_VALUES.numeric) return xScale(point.x);
		return (xScale(point.xCategory) || 0) + xJitterFor(point.index, 1.7);
	};

	const getPointY = point => {
		if (axisTypes.y === AXIS_TYPE_VALUES.numeric) return yScale(point.y);
		return (yScale(point.yCategory) || 0) + yJitterFor(point.index, 2.3);
	};

	const aggregatedCounts = points
		.filter(point => point.isAggregate)
		.map(point => Number(point.count) || 0);
	const minAggregatedCount = aggregatedCounts.length > 0 ? Math.min(...aggregatedCounts) : 1;
	const maxAggregatedCount = aggregatedCounts.length > 0 ? Math.max(...aggregatedCounts) : 1;
	const maxAggregateRadius = Math.max(radius + 6, radius * 2.1);

	let sizeScale = null;
	if (sizeMode === 'numeric' && sizeField && !shouldAggregateCategoricalPairs) {
		const sizeValues = points
			.map(point => Number(point.raw?.[sizeField]))
			.filter(Number.isFinite);
		if (sizeValues.length > 0) {
			const minV = Math.min(...sizeValues);
			const maxV = Math.max(...sizeValues);
			// scaleSqrt so visual area scales with value (correct human perception).
			const domain = minV === maxV ? [minV - 1, maxV + 1] : [minV, maxV];
			sizeScale = scaleSqrt().domain(domain).range([sizeMin, sizeMax]);
		}
	}

	const getPointRadius = point => {
		if (point.isAggregate) {
			if (maxAggregatedCount === minAggregatedCount) return maxAggregateRadius;
			const progress = ((point.count || minAggregatedCount) - minAggregatedCount) / (maxAggregatedCount - minAggregatedCount);
			return radius + ((maxAggregateRadius - radius) * progress);
		}
		if (sizeScale) {
			const v = Number(point.raw?.[sizeField]);
			if (Number.isFinite(v)) return sizeScale(v);
		}
		return radius;
	};

	let getPointColor = () => color;
	if (colorMode === 'numeric' && colorField) {
		const getNumericColorValue = point => {
			if (!point.isAggregate) {
				return Number(point.raw?.[colorField]);
			}
			const values = (point.rawRows || [])
				.map(row => Number(row?.[colorField]))
				.filter(Number.isFinite);
			if (values.length === 0) return NaN;
			return values.reduce((acc, value) => acc + value, 0) / values.length;
		};

		const numericValues = points
			.map(point => getNumericColorValue(point))
			.filter(Number.isFinite);
		if (numericValues.length > 0) {
			const min = Math.min(...numericValues);
			const max = Math.max(...numericValues);
			const delta = max - min || 1;
			if (gradientDistribution === 'rank') {
				const rankMap = buildRankMap(points, point => getNumericColorValue(point));
				const rankDenom = Math.max(rankMap.size - 1, 1);
				getPointColor = point => {
					const rank = rankMap.get(point);
					if (rank === undefined) return color;
					return interpolateColor(gradientMinColor, gradientMaxColor, rank / rankDenom);
				};
			} else {
				getPointColor = point => {
					const v = getNumericColorValue(point);
					if (!Number.isFinite(v)) return color;
					return interpolateColor(gradientMinColor, gradientMaxColor, (v - min) / delta);
				};
			}
		}
	}

	let getCategoryColorValue = null;
	let categoryMap = null;
	if (colorMode === 'category' && colorField) {
		getCategoryColorValue = point => {
			if (!point.isAggregate) {
				return normalizeCategoryValue(point.raw?.[colorField]);
			}
			return pickMostFrequentCategory(point.rawRows || [], colorField);
		};

		const palette = SCATTER_PALETTES[colorScheme];
		categoryMap = new Map();
		points.forEach(point => {
			const cat = getCategoryColorValue(point);
			if (!categoryMap.has(cat)) {
				categoryMap.set(cat, palette[categoryMap.size % palette.length]);
			}
		});
		getPointColor = point => {
			const cat = getCategoryColorValue(point);
			return categoryMap.get(cat) || color;
		};
	}

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

	const xAxis = group
		.append('g')
		.attr('transform', `translate(0,${innerHeight})`)
		.call(
			axisTypes.x === AXIS_TYPE_VALUES.numeric
				? axisBottom(xScale).ticks(8)
				: axisBottom(xScale).tickFormat(value => truncateCategoryTick(value))
		);

	const yAxis = group
		.append('g')
		.call(
			axisTypes.y === AXIS_TYPE_VALUES.numeric
				? axisLeft(yScale).ticks(8)
				: axisLeft(yScale).tickFormat(value => String(value))
		);

	if (axisTypes.x === AXIS_TYPE_VALUES.categorical) {
		xAxis
			.selectAll('text')
			.style('text-anchor', 'end')
			.attr('dx', '-0.55em')
			.attr('dy', '0.2em')
			.attr('transform', 'rotate(-28)');
	}

	if (axisTypes.y === AXIS_TYPE_VALUES.categorical) {
		yAxis
			.selectAll('text')
			.style('font-size', '10px');
	}

	if (showXAxisLabel) {
		group
			.append('text')
			.attr('x', innerWidth / 2)
			.attr('y', innerHeight + margin.bottom - 14)
			.attr('text-anchor', 'middle')
			.attr('fill', '#5f5a53')
			.attr('font-size', 11)
			.text(axisLabels.x);
	}

	if (showYAxisLabel) {
		group
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -innerHeight / 2)
			.attr('y', -margin.left + 16)
			.attr('text-anchor', 'middle')
			.attr('fill', '#5f5a53')
			.attr('font-size', 11)
			.text(axisLabels.y);
	}

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

function renderRegressionLayer({
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
	const overallColor = (typeof config.overallColor === 'string' && config.overallColor)
		? config.overallColor
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

function renderRegressionAnnotation({ group, innerWidth, regressionRender, xScale, yScale }) {
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
