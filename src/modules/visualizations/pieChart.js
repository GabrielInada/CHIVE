/**
 * Pie-chart renderer.
 *
 * Renders a D3 pie/donut with Top-N truncation, optional pad-angle gaps,
 * inside/outside slice labels, zoom, and pinned tooltips for filter
 * actions. Slice colors can be palette-derived (auto) or per-slice overrides
 * (`customSliceColors`).
 *
 * Internal D3 helpers (arc/pie generators, label placement, zoom integration)
 * are intentionally undocumented per the Tier 5 plan.
 *
 * @typedef {import('../../types.js').Result} Result
 */

import { arc, pie, select, zoom, zoomIdentity } from '../../../vendor/d3/d3.js';
import {
	buildCategoricalFilterActions,
	createFilterStateBadge,
	createTooltipActionGroup,
	createTooltipLine,
	hideChartTooltip,
	moveChartTooltip,
	showChartTooltip,
	showPinnedChartTooltip,
} from '../../charts/shared/tooltip/tooltip.js';
import { CHART_COLORS, CHART_DIMENSIONS, PIE_CHART } from '../../config/charts.js';
import { formatNumber, clamp } from '../../utils/formatters.js';
import { toCategoryToken } from '../../utils/chartFilters.js';
import { buildSliceColor as _buildSliceColor } from '../../utils/colorUtils.js';
import { ok, fail } from '../../utils/result.js';
import { appendChartTitle } from '../../charts/shared/svg/scaffold.js';
import { normalizePieOptions } from './pieChart/options.js';
import { aggregatePieData } from './pieChart/data.js';

/** @private */
function buildSliceColor(baseHex, index) {
	return _buildSliceColor(baseHex, index, CHART_COLORS.pie);
}

/**
 * Render a pie chart into `container`. Returns `ok()` on success, or
 * `fail()` when required arguments are missing or the data has no
 * non-zero sectors.
 *
 * Common option keys: `measureMode` ('count' | 'sum'), `valueColumn`,
 * `topN`, `topNMode` ('other' | 'truncate'), `innerRadius`/`outerRadius`,
 * `padAngle`, `zoomScale`, `showCategoryLabel`/`showValueLabel`/
 * `showLegend`, `labelPosition` ('inside' | 'outside'), `color`,
 * `customSliceColors` (per-token overrides), `colorScheme`, `customTitle`,
 * `chartHeight`, `locale`.
 *
 * @param {HTMLElement} container - Target DOM element. Existing contents are replaced.
 * @param {Array<Object<string, *>>} rows - Source rows.
 * @param {string} categoryColumn - Categorical column name (required).
 * @param {Object} [options={}] - Render options bag.
 * @returns {Result}
 */
export function renderPieChart(container, rows, categoryColumn, options = {}) {
	if (!container || !categoryColumn) return fail();

	const {
		color,
		locale,
		customSliceColors,
		labels,
		topN,
		topNMode,
		rawInner,
		rawOuter,
		measureMode,
		valueColumn,
		showCategoryLabel,
		showValueLabel,
		showLegend,
		labelPosition,
		customTitle,
		chartHeight,
		padAngleRad,
		zoomScale,
	} = normalizePieOptions(options);

	const aggregated = aggregatePieData(rows, categoryColumn, {
		measureMode,
		valueColumn,
		topN,
		topNMode,
		otherLabel: labels.other,
	});
	if (!aggregated.ok) return fail(aggregated.reason);
	const { entries, total } = aggregated;

	container.replaceChildren();
	hideChartTooltip();

	const width = Math.max(container.clientWidth || CHART_DIMENSIONS.pie.width, 320);
	const height = chartHeight;
	const margin = CHART_DIMENSIONS.pie.margins;
	const titleOffset = customTitle ? 18 : 0;
	const centerX = (width - margin.left - margin.right) / 2 + margin.left;
	const centerY = (height - margin.top - margin.bottom - titleOffset) / 2 + margin.top + titleOffset;
	const maxRadius = Math.max(PIE_CHART.minOuterRadius, Math.min(centerX - margin.left, centerY - margin.top));
	const outerRadius = clamp(
		Number.isFinite(rawOuter) ? rawOuter : PIE_CHART.defaultOuterRadius,
		PIE_CHART.minOuterRadius,
		Math.min(PIE_CHART.maxOuterRadius, maxRadius)
	);
	const innerRadius = clamp(
		Number.isFinite(rawInner) ? rawInner : PIE_CHART.defaultInnerRadius,
		PIE_CHART.minInnerRadius,
		Math.max(0, outerRadius - 8)
	);

	const svg = select(container)
		.append('svg')
		.attr('width', width)
		.attr('height', height);

	const viewport = svg.append('g');

	if (customTitle) {
		appendChartTitle(svg, { width, text: customTitle });
	}

	const group = viewport
		.append('g')
		.attr('transform', `translate(${centerX},${centerY})`);

	const pieGenerator = pie()
		.sort(null)
		.padAngle(padAngleRad)
		.value(item => item.value);

	const arcGenerator = arc()
		.innerRadius(innerRadius)
		.outerRadius(outerRadius);

	const labelArc = arc()
		.innerRadius(innerRadius + (outerRadius - innerRadius) * 0.62)
		.outerRadius(innerRadius + (outerRadius - innerRadius) * 0.62);

	let pinnedCategory = null;

	const buildTooltipContent = item => {
		const percentage = total > 0 ? ((item.value / total) * 100) : 0;
		const wrapper = document.createElement('div');
		wrapper.appendChild(createTooltipLine(labels.category, item.category));
		wrapper.appendChild(createTooltipLine(labels.count, formatNumber(item.value, locale)));
		wrapper.appendChild(createTooltipLine(labels.percentage, `${percentage.toFixed(1)}%`));
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
		if (item.isOther) {
			showPinnedChartTooltip(content, event.pageX, event.pageY, {
				headerTitle: String(item.category),
				closeLabel: filterLabels.close,
				onDismiss,
				actionSets: [],
			});
			return;
		}
		const token = toCategoryToken(item.category);
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
			headerTitle: String(item.category),
			closeLabel: filterLabels.close,
			onDismiss,
			actionSets: actionSet ? [actionSet] : [],
			stateBadge,
		});
	};

	group
		.selectAll('path')
		.data(pieGenerator(entries))
		.enter()
		.append('path')
		.attr('d', arcGenerator)
		.attr('fill', (item) => {
			const category = item.data.category;
			if (item.data.isOther) {
				return PIE_CHART.otherSliceColor;
			}
			if (customSliceColors[category]) {
				return customSliceColors[category];
			}
			return buildSliceColor(color, entries.findIndex(line => line.category === category));
		})
		.attr('stroke', '#fff')
		.attr('stroke-width', 1)
		.on('mouseenter', (event, item) => {
			if (pinnedCategory !== null) return;
			showTooltip(event, item.data);
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
			if (pinnedCategory === item.data.category) {
				pinnedCategory = null;
				hideChartTooltip();
				return;
			}
			pinnedCategory = item.data.category;
			showPinnedTooltip(event, item.data, () => {
				pinnedCategory = null;
				hideChartTooltip();
			});
		});

	svg.on('click', () => {
		pinnedCategory = null;
		hideChartTooltip();
	});

	const zoomBehavior = zoom()
		.extent([[0, 0], [width, height]])
		.scaleExtent([PIE_CHART.minZoomScale, PIE_CHART.maxZoomScale])
		.on('zoom', event => {
			viewport.attr('transform', event.transform);
		});

	svg.call(zoomBehavior);
	svg.call(zoomBehavior.transform, zoomIdentity.scale(zoomScale));

	const pieData = pieGenerator(entries);
	if ((showCategoryLabel || showValueLabel) && labelPosition === 'inside') {
		group
			.selectAll('text')
			.data(pieData.filter(item => ((item.endAngle - item.startAngle) / (2 * Math.PI)) >= 0.04))
			.enter()
			.append('text')
			.attr('transform', item => `translate(${labelArc.centroid(item)})`)
			.attr('text-anchor', 'middle')
			.attr('font-size', 10)
			.attr('fill', '#fff')
			.selectAll('tspan')
			.data(item => {
				const parts = [];
				if (showCategoryLabel) parts.push({ text: String(item.data.category), dy: '0' });
				if (showValueLabel) parts.push({ text: formatNumber(item.data.value, locale), dy: showCategoryLabel ? '1.1em' : '0' });
				return parts;
			})
			.enter()
			.append('tspan')
			.attr('x', 0)
			.attr('dy', part => part.dy)
			.text(part => part.text);
	}

	if ((showCategoryLabel || showValueLabel) && labelPosition === 'outside') {
		const outsideArc = arc()
			.innerRadius(outerRadius + 12)
			.outerRadius(outerRadius + 12);

		group
			.selectAll('polyline')
			.data(pieData.filter(item => ((item.endAngle - item.startAngle) / (2 * Math.PI)) >= 0.03))
			.enter()
			.append('polyline')
			.attr('stroke', '#6a655d')
			.attr('stroke-width', 1)
			.attr('fill', 'none')
			.attr('points', item => {
				const start = arcGenerator.centroid(item);
				const mid = outsideArc.centroid(item);
				const offsetX = mid[0] >= 0 ? 14 : -14;
				const end = [mid[0] + offsetX, mid[1]];
				return [start, mid, end].map(point => point.join(',')).join(' ');
			});

		group
			.selectAll('text.pie-outside-label')
			.data(pieData.filter(item => ((item.endAngle - item.startAngle) / (2 * Math.PI)) >= 0.03))
			.enter()
			.append('text')
			.attr('class', 'pie-outside-label')
			.attr('x', item => {
				const [x] = outsideArc.centroid(item);
				return x + (x >= 0 ? 18 : -18);
			})
			.attr('y', item => outsideArc.centroid(item)[1])
			.attr('text-anchor', item => outsideArc.centroid(item)[0] >= 0 ? 'start' : 'end')
			.attr('font-size', 10)
			.attr('fill', '#3f3a33')
			.selectAll('tspan')
			.data(item => {
				const parts = [];
				if (showCategoryLabel) parts.push({ text: String(item.data.category), dy: '0' });
				if (showValueLabel) parts.push({ text: formatNumber(item.data.value, locale), dy: showCategoryLabel ? '1.1em' : '0' });
				return parts;
			})
			.enter()
			.append('tspan')
			.attr('x', function setX() { return this.parentNode.getAttribute('x'); })
			.attr('dy', part => part.dy)
			.text(part => part.text);
	}

	if (showLegend) {
		const legend = svg
			.append('g')
			.attr('transform', `translate(${Math.max(centerX + outerRadius + 26, width - 180)},${Math.max(14, centerY - outerRadius)})`);

		entries.slice(0, 8).forEach((item, index) => {
			const row = legend.append('g').attr('transform', `translate(0,${index * 16})`);
			const swatch = item.isOther
				? PIE_CHART.otherSliceColor
				: (customSliceColors[item.category] || buildSliceColor(color, index));
			row.append('rect')
				.attr('width', 10)
				.attr('height', 10)
				.attr('rx', 2)
				.attr('fill', swatch);
			row.append('text')
				.attr('x', 14)
				.attr('y', 9)
				.attr('font-size', 10)
				.attr('fill', '#3f3a33')
				.text(`${item.category} (${formatNumber(item.value, locale)})`);
		});
	}

	return ok();
}
