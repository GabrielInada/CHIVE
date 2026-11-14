/**
 * Bar-chart renderer.
 *
 * Renders a vertical bar chart with count/sum/mean aggregation, Top-N
 * trimming, color modes (uniform / auto gradient / manual threshold), and
 * click-to-filter tooltip actions. Internal D3 helpers (scale setup, label
 * positioning, gradient interpolation) are intentionally undocumented per
 * the Tier 5 plan, only the entry signature is part of the public API.
 *
 * @typedef {import('../../../types.js').Result} Result
 */

import { formatCurrencyCategory, currencyAxisMargin } from '../../shared/currency.js';
import { axisBottom, axisLeft, max, min, scaleBand, scaleLinear } from '../../../../vendor/d3/d3.js';
import {
	createTooltipLine,
	hideChartTooltip,
	hideHoverTooltip,
	moveChartTooltip,
	showChartTooltip,
} from '../../shared/tooltip/tooltip.js';
import { togglePinnedFilterTooltip } from '../../shared/tooltip/filterActions.js';
import { BAR_CHART } from '../../../config/charts/definitions/bar.js';
import { CHART_DIMENSIONS } from '../../../config/charts/definitions.js';
import { resolveChartWidth } from '../../shared/chartWidth.js';
import { categoryTickValues, truncateAxisLabel } from '../../shared/axisTicks.js';
import { formatNumber } from '../../../utils/formatters.js';
import { ok, fail } from '../../../utils/result.js';
import {
	appendAxisLabels,
	appendBottomAxis,
	appendLeftAxis,
	setupChartSvg,
} from '../../shared/svg/scaffold.js';
import { aggregateCategories } from '../../shared/categoryAggregation.js';
import { normalizeBarOptions } from '../options.js';
import { createBarColorAccessor } from '../color.js';

/**
 * Render a bar chart into `container`. Returns `ok()` on success, or
 * `fail(reason)` on early exit:
 *   - no `categoryColumn` or no container → `fail()`
 *   - `measureMode` is sum/mean but `valueColumn` is missing → `fail('no-value-column')`
 *   - sum/mean over no parseable numbers → `fail('no-numeric')`
 *   - empty data → `fail()`
 *
 * The full option bag varies; see `BAR_CHART` and `BAR_DEFINITION` in
 * `config/charts/definitions/bar.js` for the field set and defaults.
 * Frequently used keys include `sort` (value-desc/asc, label-asc/desc),
 * `topN`, `measureMode`
 * ('count' | 'sum' | 'mean'), `valueColumn`, `colorMode`
 * ('uniform' | 'gradient' | 'gradient-manual'), color stops, axis label
 * toggles, `customTitle`, and `chartHeight` live in config. Presentation supplies
 * `context.labels.measure` for the tooltip and `context.axisLabels.y` for the
 * y axis, alongside locale and filter callbacks.
 *
 * @param {HTMLElement} container - Target DOM element. Existing contents are replaced.
 * @param {Array<Object<string, *>>} rows - Source rows.
 * @param {Object} config - Stored chart config, normalized once inside the renderer.
 * @param {Object} context - Localized labels, locale, and runtime callbacks from presentation.
 * @returns {Result}
 */
export function renderBarChart(container, rows, config = {}, context = {}) {
	const { category: categoryColumn } = config;
	const { labels = {}, axisLabels = {}, locale, filterCallbacks, currencies = {} } = context;
	if (!container || !categoryColumn) return fail();
	const {
		sort,
		topN,
		showXAxisLabel,
		showYAxisLabel,
		measureMode,
		valueColumn,
		color,
		colorMode,
		gradientMinColor,
		gradientMaxColor,
		manualThresholdPct,
		gradientDistribution,
		customTitle,
		chartHeight,
	} = normalizeBarOptions(config);

	const aggregated = aggregateCategories(rows, categoryColumn, {
		measureMode, valueColumn, sort, topN, missingLabel: labels.missing,
	});
	if (!aggregated.ok) return fail(aggregated.reason);
	const { entries, retainedValueTotal } = aggregated;
	for (const item of entries) item.label = formatCurrencyCategory(item.label, currencies.category, locale);

	const width = resolveChartWidth(container, CHART_DIMENSIONS.bar.width);
	const height = chartHeight;
	const margin = { ...CHART_DIMENSIONS.bar.margins };
	margin.left = currencyAxisMargin(margin.left, entries.map(item => item.value), currencies.measure, locale);
	const { svg, group, innerWidth, innerHeight } = setupChartSvg(container, {
		width,
		height,
		margin,
		customTitle,
	});
	hideChartTooltip();

	// WHY: with a total below 0, a share of the net total can pass 100% or go
	// below 0%, so the tooltip leaves it out, as it does for a mean.
	const showsShare = measureMode !== 'mean' && entries.every(item => item.value >= 0);

	const buildTooltipContent = item => {
		const percentage = retainedValueTotal > 0 ? ((item.value / retainedValueTotal) * 100) : 0;
		const wrapper = document.createElement('div');

		wrapper.appendChild(createTooltipLine(labels.category, item.label));
		wrapper.appendChild(createTooltipLine(labels.measure, formatNumber(item.value, locale, currencies.measure)));
		if (showsShare) {
			wrapper.appendChild(createTooltipLine(labels.percentage, `${percentage.toFixed(1)}%`));
		}

		return wrapper;
	};

	const showTooltip = (event, item) => {
		showChartTooltip(buildTooltipContent(item), event.pageX, event.pageY);
	};

	const togglePinnedTooltip = (event, item) => {
		togglePinnedFilterTooltip(buildTooltipContent(item), event.pageX, event.pageY, {
			target: event.currentTarget,
			headerTitle: item.label,
			closeLabel: labels.close,
			filterActionLabels: labels.filterActions,
			filterCallbacks,
			categories: [{ column: categoryColumn, token: item.token }],
		});
	};

	const labelByKey = new Map(entries.map(item => [item.key, item.label]));
	const xScale = scaleBand()
		.domain(entries.map(item => item.key))
		.range([0, innerWidth])
		.padding(0.14);

	// WHY: 0 stays on the y axis so every bar runs from it, up for a value
	// above 0 and down for one below. With every value 0 the domain would
	// collapse to 0 alone, so the axis runs from 0 to 1 instead.
	const yLower = Math.min(0, min(entries, item => item.value));
	const yUpper = Math.max(0, max(entries, item => item.value));
	const yScale = scaleLinear()
		.domain(yLower === yUpper ? [0, 1] : [yLower, yUpper])
		.nice()
		.range([innerHeight, 0]);
	const zeroY = yScale(0);

	const getBarColor = createBarColorAccessor({
		entries,
		colorMode,
		color,
		gradientMinColor,
		gradientMaxColor,
		gradientDistribution,
		manualThresholdPct,
	});

	group
		.selectAll('rect')
		.data(entries)
		.enter()
		.append('rect')
		.attr('x', item => xScale(item.key))
		.attr('y', item => Math.min(yScale(item.value), zeroY))
		.attr('width', xScale.bandwidth())
		.attr('height', item => Math.abs(yScale(item.value) - zeroY))
		.attr('rx', 3)
		.attr('fill', item => getBarColor(item))
		.on('mouseenter', (event, item) => {
			showTooltip(event, item);
		})
		.on('mousemove', event => {
			moveChartTooltip(event.pageX, event.pageY);
		})
		.on('mouseleave', () => {
			hideHoverTooltip();
		})
		.on('click', (event, item) => {
			event.stopPropagation();
			togglePinnedTooltip(event, item);
		});

	svg.on('click', () => {
		hideChartTooltip();
	});

	// WHY: the category axis stays at the bottom of the plot, where its labels
	// never sit on a bar below 0, so when 0 is higher up it gets a line of its own.
	if (yLower < 0) {
		group
			.append('line')
			.attr('class', 'bar-zero-line')
			.attr('x1', 0)
			.attr('x2', innerWidth)
			.attr('y1', zeroY)
			.attr('y2', zeroY)
			.attr('stroke', 'currentColor')
			.attr('pointer-events', 'none');
	}

	appendBottomAxis(group, {
		axis: axisBottom(xScale)
			.tickValues(width < 480 ? categoryTickValues(xScale.domain(), innerWidth) : null)
			.tickFormat(key => {
				const label = labelByKey.get(key) ?? key;
				return width < 480 ? truncateAxisLabel(label) : label;
			}),
		innerHeight,
		tickRotation: { angle: -30, dx: '-0.6em', dy: '0.15em' },
	});

	appendLeftAxis(group, { axis: axisLeft(yScale).ticks(BAR_CHART.ticks).tickFormat(currencies.measure ? value => formatNumber(value, locale, currencies.measure) : null) });

	appendAxisLabels(group, {
		innerWidth,
		innerHeight,
		marginLeft: margin.left,
		marginBottom: margin.bottom,
		axisLabels,
		showX: showXAxisLabel,
		showY: showYAxisLabel,
		xBottomInset: 18,
	});

	return ok();
}
