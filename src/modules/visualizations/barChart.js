/**
 * Bar-chart renderer.
 *
 * Renders a vertical bar chart with count/sum/mean aggregation, Top-N
 * trimming, color modes (uniform / auto gradient / manual threshold), and
 * click-to-filter tooltip actions. Internal D3 helpers (scale setup, label
 * positioning, gradient interpolation) are intentionally undocumented per
 * the Tier 5 plan, only the entry signature is part of the public API.
 *
 * @typedef {import('../../types.js').Result} Result
 */

import { axisBottom, axisLeft, max, scaleBand, scaleLinear } from '../../../vendor/d3/d3.js';
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
import { BAR_CHART, CHART_DIMENSIONS, CHART_COLORS } from '../../config/charts.js';
import { formatNumber, isNullish } from '../../utils/formatters.js';
import { toCategoryToken, compareStrings } from '../../utils/chartFilters.js';
import { interpolateColor, buildRankMap, isValidHexColor } from '../../utils/colorUtils.js';
import { ok, fail } from '../../utils/result.js';
import {
	appendAxisLabels,
	appendBottomAxis,
	appendLeftAxis,
	setupChartSvg,
} from './chartScaffold.js';

// WHY: every count-based sort uses `|| compareStrings(a[0], b[0])` as a tiebreaker
// so categories with equal counts have a deterministic visual order. Without the
// secondary string compare, sort stability varies by browser engine and the bar
// order can flicker between renders on identical data.
function sortCategories(entries, sort) {
	if (sort === 'count-asc') {
		return entries.sort((a, b) => a[1] - b[1] || compareStrings(a[0], b[0]));
	}

	if (sort === 'label-asc') {
		return entries.sort((a, b) => compareStrings(a[0], b[0]));
	}

	if (sort === 'label-desc') {
		return entries.sort((a, b) => compareStrings(b[0], a[0]));
	}

	return entries.sort((a, b) => b[1] - a[1] || compareStrings(a[0], b[0]));
}

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
	const sort = options.sort || BAR_CHART.defaultSort;
	const topN = Number.isFinite(Number(options.topN)) ? Number(options.topN) : BAR_CHART.defaultTopN;
	const showXAxisLabel = options.showXAxisLabel !== false;
	const showYAxisLabel = options.showYAxisLabel !== false;
	const labels = {
		category: options.labels?.category || 'Category',
		count: options.labels?.count || 'Count',
		sum: options.labels?.sum || 'Sum',
		mean: options.labels?.mean || 'Mean',
		percentage: options.labels?.percentage || 'Percentage',
		focusOnThis: options.labels?.focusOnThis || 'Show only this',
		addToFilter: options.labels?.addToFilter || 'Add to global filter',
	};
	const measureMode = BAR_CHART.measureModes.includes(options.measureMode)
		? options.measureMode
		: BAR_CHART.defaultMeasureMode;
	const valueColumn = options.valueColumn || null;
	const hasValueColumn = (measureMode === 'count')
		? true
		: rows.some(row => Object.prototype.hasOwnProperty.call(row, valueColumn));
	const axisLabels = {
		x: options.axisLabels?.x || categoryColumn,
		y: options.axisLabels?.y
			|| (measureMode === 'mean'
				? labels.mean
				: measureMode === 'sum'
					? labels.sum
					: labels.count),
	};
	const color = isValidHexColor(String(options.color || '').trim())
		? String(options.color).trim()
		: CHART_COLORS.bar;
	const colorMode = ['uniform', 'gradient', 'gradient-manual'].includes(options.colorMode)
		? options.colorMode
		: 'uniform';
	const gradientMinColor = isValidHexColor(String(options.gradientMinColor || '').trim())
		? String(options.gradientMinColor).trim()
		: color;
	const gradientMaxColor = isValidHexColor(String(options.gradientMaxColor || '').trim())
		? String(options.gradientMaxColor).trim()
		: '#ffffff';
	const manualThresholdPct = Number.isFinite(Number(options.manualThresholdPct))
		? Math.max(0, Math.min(100, Number(options.manualThresholdPct)))
		: 50;
	const gradientDistribution = options.gradientDistribution === 'rank' ? 'rank' : 'value';
	const customTitle = String(options.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(options.chartHeight))
		? Math.max(220, Math.min(720, Number(options.chartHeight)))
		: CHART_DIMENSIONS.bar.height;
	const locale = options.locale || undefined;

	const counter = new Map();
	const counterN = new Map();

	if (measureMode === 'count') {
		rows.forEach(row => {
			const rawValue = row[categoryColumn];
			const category = isNullish(rawValue) || rawValue === ''
				? 'N/A'
				: String(rawValue);
			counter.set(category, (counter.get(category) || 0) + 1);
		});
	} else {
		if (!valueColumn || !hasValueColumn) return fail('no-value-column');
		rows.forEach(row => {
			const rawValue = row[categoryColumn];
			const category = isNullish(rawValue) || rawValue === ''
				? 'N/A'
				: String(rawValue);
			const value = Number(row[valueColumn]);
			if (!Number.isFinite(value)) return;
			counter.set(category, (counter.get(category) || 0) + value);
			counterN.set(category, (counterN.get(category) || 0) + 1);
		});

		if (measureMode === 'mean') {
			for (const [category, sum] of counter.entries()) {
				counter.set(category, sum / (counterN.get(category) || 1));
			}
		}
	}

	if ((measureMode === 'sum' || measureMode === 'mean') && counter.size === 0) {
		return fail('no-numeric');
	}

	let entries = Array.from(counter.entries());
	entries = sortCategories(entries, sort);

	if (topN > 0) {
		entries = entries.slice(0, topN);
	}

	if (entries.length === 0) return fail();
	const totalContagem = entries.reduce((acc, item) => acc + item[1], 0);

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

	const minValor = Math.min(...entries.map(item => item[1]));
	const maxValor = Math.max(...entries.map(item => item[1]));
	const deltaValor = maxValor - minValor || 1;
	const thresholdValue = minValor + (deltaValor * (manualThresholdPct / 100));
	const rankMap = (colorMode === 'gradient' && gradientDistribution === 'rank')
		? buildRankMap(entries, item => item[1])
		: null;
	const rankDenom = Math.max(entries.length - 1, 1);

	const getBarColor = (item) => {
		if (colorMode === 'uniform') return color;
		if (colorMode === 'gradient') {
			if (rankMap) {
				const rank = rankMap.get(item);
				if (rank === undefined) return gradientMinColor;
				return interpolateColor(gradientMinColor, gradientMaxColor, rank / rankDenom);
			}
			return interpolateColor(gradientMinColor, gradientMaxColor, (item[1] - minValor) / deltaValor);
		}
		if (colorMode === 'gradient-manual') {
			return item[1] <= thresholdValue ? gradientMinColor : gradientMaxColor;
		}
		return color;
	};

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
