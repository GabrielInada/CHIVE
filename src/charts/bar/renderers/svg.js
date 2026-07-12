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

import { axisBottom, axisLeft, max, scaleBand, scaleLinear } from '../../../../vendor/d3/d3.js';
import {
	buildCategoricalFilterActions,
	createFilterStateBadge,
	createTooltipActionGroup,
	createTooltipLine,
	hideChartTooltip,
	moveChartTooltip,
	showChartTooltip,
	showPinnedChartTooltip,
} from '../../shared/tooltip/tooltip.js';
import { BAR_CHART, CHART_DIMENSIONS } from '../../../config/charts.js';
import { formatNumber } from '../../../utils/formatters.js';
import { toCategoryToken } from '../../../utils/chartFilters.js';
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
 * The full option bag varies; see `BAR_CHART` and `CHART_DIMENSIONS` in
 * `config/charts.js` for the field set and defaults. Frequently used keys
 * include `sort` (count-desc/asc, label-asc/desc), `topN`, `measureMode`
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

	const aggregated = aggregateBarData(rows, categoryColumn, { measureMode, valueColumn, sort, topN });
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

	const buildTooltipContent = item => {
		const percentage = totalContagem > 0 ? ((item[1] / totalContagem) * 100) : 0;
		const wrapper = document.createElement('div');
		const valueLabel = measureMode === 'mean'
			? labels.mean
			: measureMode === 'sum'
				? labels.sum
				: labels.count;

		wrapper.appendChild(createTooltipLine(labels.category, String(item[0])));
		wrapper.appendChild(createTooltipLine(valueLabel, formatNumber(item[1], locale)));
		if (measureMode !== 'mean') {
			wrapper.appendChild(createTooltipLine(labels.percentage, `${percentage.toFixed(1)}%`));
		}

		return wrapper;
	};

	const showTooltip = (event, item) => {
		showChartTooltip(buildTooltipContent(item), event.pageX, event.pageY);
	};

	const filterCallbacks = options.filterCallbacks || {};
	const filterLabels = filterCallbacks.filterActionLabels || {};
	const actionLabels = {
		focus: filterLabels.focus || labels.focusOnThis,
		add: filterLabels.add || labels.addToFilter,
		exclude: filterLabels.exclude || 'Hide this',
		remove: filterLabels.remove || 'Remove from filter',
		bringBack: filterLabels.bringBack || 'Bring back',
	};

	const showPinnedTooltip = (event, item, onDismiss) => {
		const content = buildTooltipContent(item);
		const token = toCategoryToken(item[0]);
		const state = typeof filterCallbacks.getTokenFilterState === 'function'
			? filterCallbacks.getTokenFilterState(categoryColumn, token)
			: null;
		const omitFocus = typeof filterCallbacks.isShowOnlyThisRedundant === 'function'
			? !!filterCallbacks.isShowOnlyThisRedundant(categoryColumn, token)
			: false;
		const actions = buildCategoricalFilterActions({
			column: categoryColumn,
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
		const stateBadge = createFilterStateBadge({
			state,
			includedLabel: filterLabels.stateIncluded,
			excludedLabel: filterLabels.stateExcluded,
		});
		const actionSet = actions.length > 0 ? createTooltipActionGroup(actions) : null;
		showPinnedChartTooltip(content, event.pageX, event.pageY, {
			headerTitle: String(item[0]),
			closeLabel: filterLabels.close,
			onDismiss,
			actionSets: actionSet ? [actionSet] : [],
			stateBadge,
		});
	};

	const xScale = scaleBand()
		.domain(entries.map(item => item[0]))
		.range([0, innerWidth])
		.padding(0.14);

	const yScale = scaleLinear()
		.domain([0, max(entries, item => item[1]) || 0])
		.nice()
		.range([innerHeight, 0]);

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
		.attr('x', item => xScale(item[0]))
		.attr('y', item => yScale(item[1]))
		.attr('width', xScale.bandwidth())
		.attr('height', item => innerHeight - yScale(item[1]))
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
			if (pinnedCategory === item[0]) {
				pinnedCategory = null;
				hideChartTooltip();
				return;
			}
			pinnedCategory = item[0];
			showPinnedTooltip(event, item, () => {
				pinnedCategory = null;
				hideChartTooltip();
			});
		});

	svg.on('click', () => {
		pinnedCategory = null;
		hideChartTooltip();
	});

	appendBottomAxis(group, {
		axis: axisBottom(xScale),
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
