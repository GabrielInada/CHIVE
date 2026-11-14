/**
 * Pie-chart renderer.
 *
 * Renders a D3 pie/donut of the sectors `computePieSectors` returns, in their
 * order and fills, with optional pad-angle gaps, inside/outside slice labels,
 * zoom, and pinned tooltips for filter actions.
 *
 * Internal D3 helpers (arc/pie generators, label placement, zoom integration)
 * are intentionally undocumented per the Tier 5 plan.
 *
 * @typedef {import('../../../types.js').Result} Result
 */

import { formatCurrencyCategory } from '../../shared/currency.js';
import { arc, pie, select, zoom, zoomIdentity } from '../../../../vendor/d3/d3.js';
import {
	createTooltipLine,
	hideChartTooltip,
	hideHoverTooltip,
	moveChartTooltip,
	showChartTooltip,
} from '../../shared/tooltip/tooltip.js';
import { togglePinnedFilterTooltip } from '../../shared/tooltip/filterActions.js';
import { CHART_DIMENSIONS } from '../../../config/charts/definitions.js';
import { resolveChartWidth } from '../../shared/chartWidth.js';
import { truncateAxisLabel } from '../../shared/axisTicks.js';
import { allowChartZoom } from '../../shared/gestures.js';
import { PIE_CHART } from '../../../config/charts/definitions/pie.js';
import { formatNumber, clamp } from '../../../utils/formatters.js';
import { ok, fail } from '../../../utils/result.js';
import { appendChartTitle } from '../../shared/svg/scaffold.js';
import { normalizePieOptions } from '../options.js';
import { computePieSectors } from '../data.js';
import { appendPieLegend } from './legend.js';

/**
 * Render a pie chart into `container`. Returns `ok()` on success, or
 * `fail()` when required arguments are missing or `computePieSectors` fails,
 * as it does with `'no-positive-value'` when no category has a value
 * above 0.
 *
 * Common config keys: `measureMode` ('count' | 'sum'), `valueColumn`,
 * `topN`, `topNMode` ('other' | 'truncate'), `innerRadius`/`outerRadius`,
 * `padAngle`, `zoomScale`, `showCategoryLabel`/`showValueLabel`/
 * `showLegend`, `labelPosition` ('inside' | 'outside'), `color`,
 * `customSliceColors` (overrides by category key), `customTitle`,
 * and `chartHeight`. The separate context supplies locale, filter callbacks
 * and localized labels; `labels.measure` names the measure in the tooltip.
 *
 * @param {HTMLElement} container - Target DOM element. Existing contents are replaced.
 * @param {Array<Object<string, *>>} rows - Source rows.
 * @param {Object} config - Stored chart config, normalized once inside the renderer.
 * @param {Object} context - Localized labels, locale, and runtime callbacks from presentation.
 * @returns {Result}
 */
export function renderPieChart(container, rows, config = {}, context = {}) {
	const { category: categoryColumn } = config;
	const { labels = {}, locale, filterCallbacks, currencies = {} } = context;
	if (!container || !categoryColumn) return fail();

	const normalized = normalizePieOptions(config);
	const {
		rawInner,
		rawOuter,
		showCategoryLabel,
		showValueLabel,
		showLegend,
		labelPosition,
		customTitle,
		chartHeight,
		padAngleRad,
		zoomScale,
	} = normalized;

	const drawn = computePieSectors(rows, categoryColumn, normalized, labels);
	if (!drawn.ok) return fail(drawn.reason);
	const { sectors, total } = drawn;
	for (const item of sectors) item.label = formatCurrencyCategory(item.label, currencies.category, locale);

	container.replaceChildren();
	hideChartTooltip();

	const width = resolveChartWidth(container, CHART_DIMENSIONS.pie.width);
	const margin = CHART_DIMENSIONS.pie.margins;
	const stackedLegend = showLegend && (width < 480 || sectors.length > 8);
	const svg = select(container).append('svg').attr('width', width);
	const viewport = svg.append('g');
	const title = appendChartTitle(svg, { width, text: customTitle });
	const titleOffset = customTitle ? 18 + Math.max(0, title.selectAll('tspan').size() - 1) * 16 : 0;
	const legendLayout = showLegend
		? appendPieLegend(svg, sectors, { stacked: stackedLegend, width: width - margin.left - margin.right, locale, currency: currencies.measure })
		: null;
	const legendHeight = stackedLegend ? legendLayout.height : 0;
	// Preserve a readable plot and let the local chart surface scroll for long
	// legends. The live SVG (and therefore SVG exports) contains every category.
	const height = stackedLegend
		? Math.max(chartHeight, 200 + margin.top + margin.bottom + titleOffset + legendHeight)
		: chartHeight;
	if (stackedLegend) svg.attr('class', 'pie-chart-scrollable');
	svg.attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);
	const centerX = (width - margin.left - margin.right) / 2 + margin.left;
	const centerY = (height - legendHeight - margin.top - margin.bottom - titleOffset) / 2 + margin.top + titleOffset;
	const maxRadius = Math.max(PIE_CHART.minOuterRadius, Math.min(centerX - margin.left, centerY - margin.top - titleOffset));
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

	const buildTooltipContent = item => {
		const percentage = total > 0 ? ((item.value / total) * 100) : 0;
		const wrapper = document.createElement('div');
		wrapper.appendChild(createTooltipLine(labels.category, item.label));
		wrapper.appendChild(createTooltipLine(labels.measure, formatNumber(item.value, locale, currencies.measure)));
		wrapper.appendChild(createTooltipLine(labels.percentage, `${percentage.toFixed(1)}%`));
		return wrapper;
	};

	const showTooltip = (event, item) => {
		showChartTooltip(buildTooltipContent(item), event.pageX, event.pageY);
	};

	const togglePinnedTooltip = (event, item) => {
		// The Other sector has no category token, so it offers no filter actions.
		togglePinnedFilterTooltip(buildTooltipContent(item), event.pageX, event.pageY, {
			target: event.currentTarget,
			headerTitle: item.label,
			closeLabel: labels.close,
			filterActionLabels: labels.filterActions,
			filterCallbacks,
			categories: [{ column: categoryColumn, token: item.token }],
		});
	};

	group
		.selectAll('path')
		.data(pieGenerator(sectors))
		.enter()
		.append('path')
		.attr('d', arcGenerator)
		.attr('fill', item => item.data.color)
		.attr('stroke', '#fff')
		.attr('stroke-width', 1)
		.on('mouseenter', (event, item) => {
			showTooltip(event, item.data);
		})
		.on('mousemove', event => {
			moveChartTooltip(event.pageX, event.pageY);
		})
		.on('mouseleave', () => {
			hideHoverTooltip();
		})
		.on('click', (event, item) => {
			event.stopPropagation();
			togglePinnedTooltip(event, item.data);
		});

	svg.on('click', () => {
		hideChartTooltip();
	});

	const zoomBehavior = zoom()
		.filter(event => allowChartZoom(event) && !event.target?.closest?.('.pie-legend-stacked'))
		.extent([[0, 0], [width, height]])
		.scaleExtent([PIE_CHART.minZoomScale, PIE_CHART.maxZoomScale])
		.on('zoom', event => {
			viewport.attr('transform', event.transform);
		});

	svg.call(zoomBehavior);
	svg.call(zoomBehavior.transform, zoomIdentity.scale(zoomScale));

	const pieData = pieGenerator(sectors);
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
				const labelRadius = innerRadius + (outerRadius - innerRadius) * 0.62;
				const sliceWidth = 2 * labelRadius * Math.sin(Math.min(Math.PI, item.endAngle - item.startAngle) / 2);
				const maxLength = width < 480 || sectors.length > 8
					? Math.floor(Math.min(outerRadius, sliceWidth * 0.85) / 6)
					: Infinity;
				if (showCategoryLabel && (maxLength >= 3 || item.data.label.length <= maxLength)) {
					parts.push({ text: truncateAxisLabel(item.data.label, maxLength), dy: '0' });
				}
				const value = formatNumber(item.data.value, locale, currencies.measure);
				if (showValueLabel && value.length <= maxLength) {
					parts.push({ text: value, dy: parts.length ? '1.1em' : '0' });
				}
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
				const [x] = outsideArc.centroid(item);
				const availableWidth = x >= 0
					? width - margin.right - (centerX + x + 18)
					: centerX + x - 18 - margin.left;
				const maxLength = Math.floor(availableWidth / 6);
				if (showCategoryLabel && (maxLength >= 3 || item.data.label.length <= maxLength)) {
					parts.push({ text: truncateAxisLabel(item.data.label, maxLength), dy: '0' });
				}
				const value = formatNumber(item.data.value, locale, currencies.measure);
				if (showValueLabel && value.length <= maxLength) {
					parts.push({ text: value, dy: parts.length ? '1.1em' : '0' });
				}
				return parts;
			})
			.enter()
			.append('tspan')
			.attr('x', function setX() { return this.parentNode.getAttribute('x'); })
			.attr('dy', part => part.dy)
			.text(part => part.text);
	}

	if (showLegend) {
		legendLayout.legend.attr('transform', stackedLegend
				? `translate(${margin.left},${height - legendHeight + 8})`
				: `translate(${Math.max(centerX + outerRadius + 26, width - 180)},${Math.max(14, centerY - outerRadius)})`);
		// Keep the legend above the zoomable marks in SVG paint order.
		svg.node().appendChild(legendLayout.legend.node());
	}
	if (stackedLegend && container.clientHeight > 0 && height > container.clientHeight + 1 && labels.scrollLegend) {
		const scrollRegion = document.createElement('div');
		scrollRegion.className = 'chart-scroll-region';
		scrollRegion.tabIndex = 0;
		scrollRegion.setAttribute('role', 'region');
		scrollRegion.setAttribute('aria-label', labels.scrollLegend);
		const hint = document.createElement('p');
		hint.className = 'chart-legend-scroll-hint';
		hint.textContent = labels.scrollLegend;
		scrollRegion.append(svg.node(), hint);
		container.appendChild(scrollRegion);
	}

	return ok();
}
