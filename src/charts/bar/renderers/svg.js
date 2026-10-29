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

import { axisBottom, axisLeft, max, min, scaleBand, scaleLinear } from '../../../../vendor/d3/d3.js';
import {
	createTooltipLine,
	hideChartTooltip,
	moveChartTooltip,
	showChartTooltip,
} from '../../shared/tooltip/tooltip.js';
import { showPinnedFilterTooltip } from '../../shared/tooltip/filterActions.js';
import { BAR_CHART } from '../../../config/charts/definitions/bar.js';
import { CHART_DIMENSIONS } from '../../../config/charts/definitions.js';
import { formatNumber } from '../../../utils/formatters.js';
import { ok, fail } from '../../../utils/result.js';
import {
	appendAxisLabels,
	appendBottomAxis,
	appendLeftAxis,
	setupChartSvg,
} from '../../shared/svg/scaffold.js';
import { normalizeBarOptions } from '../options.js';
import { aggregateBarData } from '../data.js';
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
 * Frequently used keys include `sort` (count-desc/asc, label-asc/desc),
 * `topN`, `measureMode`
 * ('count' | 'sum' | 'mean'), `valueColumn`, `colorMode`
 * ('uniform' | 'gradient' | 'gradient-manual'), color stops, axis label
 * toggles, `customTitle`, `chartHeight`, `locale`, and the localized
 * `labels`/`axisLabels` bags.
 *
 * @param {HTMLElement} container - Target DOM element. Existing contents are replaced.
 * @param {Array<Object<string, *>>} rows - Source rows.
 * @param {string} categoryColumn - Categorical column name (required).
 * @param {Object} [options={}] - Render options bag.
 * @returns {Result}
 */
export function renderBarChart(container, rows, categoryColumn, options = {}) {
	if (!container || !categoryColumn) return fail();
	const {
		sort,
		topN,
		showXAxisLabel,
		showYAxisLabel,
		labels,
		measureMode,
		valueColumn,
		axisLabels,
		color,
		colorMode,
		gradientMinColor,
		gradientMaxColor,
		manualThresholdPct,
		gradientDistribution,
		customTitle,
		chartHeight,
		locale,
	} = normalizeBarOptions(options, categoryColumn);

	const aggregated = aggregateBarData(rows, categoryColumn, {
		measureMode, valueColumn, sort, topN, missingLabel: labels.missing,
	});
	if (!aggregated.ok) return fail(aggregated.reason);
	const { entries, total: totalContagem } = aggregated;

	const width = Math.max(container.clientWidth || CHART_DIMENSIONS.bar.width, 320);
	const height = chartHeight;
	const margin = CHART_DIMENSIONS.bar.margins;
	const { svg, group, innerWidth, innerHeight } = setupChartSvg(container, {
		width,
		height,
		margin,
		customTitle,
	});
	hideChartTooltip();

	let pinnedCategory = null;
	// WHY: with a total below 0, a share of the net total can pass 100% or go
	// below 0%, so the tooltip leaves it out, as it does for a mean.
	const showsShare = measureMode !== 'mean' && entries.every(item => item.value >= 0);

	const buildTooltipContent = item => {
		const percentage = totalContagem > 0 ? ((item.value / totalContagem) * 100) : 0;
		const wrapper = document.createElement('div');
		const valueLabel = measureMode === 'mean'
			? labels.mean
			: measureMode === 'sum'
				? labels.sum
				: labels.count;

		wrapper.appendChild(createTooltipLine(labels.category, item.label));
		wrapper.appendChild(createTooltipLine(valueLabel, formatNumber(item.value, locale)));
		if (showsShare) {
			wrapper.appendChild(createTooltipLine(labels.percentage, `${percentage.toFixed(1)}%`));
		}

		return wrapper;
	};

	const showTooltip = (event, item) => {
		showChartTooltip(buildTooltipContent(item), event.pageX, event.pageY);
	};

	const showPinnedTooltip = (event, item, onDismiss) => {
		showPinnedFilterTooltip(buildTooltipContent(item), event.pageX, event.pageY, {
			headerTitle: item.label,
			onDismiss,
			filterCallbacks: options.filterCallbacks,
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
			if (pinnedCategory !== null) return;
			showTooltip(event, item);
		})
		.on('mousemove', event => {
			if (pinnedCategory !== null) return;
			moveChartTooltip(event.pageX, event.pageY);
		})
		.on('mouseleave', () => {
			if (pinnedCategory !== null) return;
			hideChartTooltip();
		})
		.on('click', (event, item) => {
			event.stopPropagation();
			if (pinnedCategory === item.key) {
				pinnedCategory = null;
				hideChartTooltip();
				return;
			}
			pinnedCategory = item.key;
			showPinnedTooltip(event, item, () => {
				pinnedCategory = null;
				hideChartTooltip();
			});
		});

	svg.on('click', () => {
		pinnedCategory = null;
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
		axis: axisBottom(xScale).tickFormat(key => labelByKey.get(key) ?? key),
		innerHeight,
		tickRotation: { angle: -30, dx: '-0.6em', dy: '0.15em' },
	});

	appendLeftAxis(group, { axis: axisLeft(yScale).ticks(BAR_CHART.ticks) });

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
