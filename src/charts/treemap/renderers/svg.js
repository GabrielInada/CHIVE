/**
 * Treemap renderer.
 *
 * Renders a D3 treemap with squarified tiling. Sizes can come from row
 * count or a numeric sum; coloring is palette-derived ('scheme' mode) or
 * a single uniform color.
 *
 * Internal D3 helpers (treemap layout, label truncation, palette lookup)
 * are intentionally undocumented per the Tier 5 plan.
 *
 * @typedef {import('../../../types.js').Result} Result
 */

import { formatCurrencyCategory } from '../../shared/currency.js';
import { hierarchy, select, treemap, treemapSquarify } from '../../../../vendor/d3/d3.js';
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
import { CHART_COLOR_PALETTES } from '../../../config/charts/shared.js';
import { formatNumber, clamp } from '../../../utils/formatters.js';
import { appendChartTitle } from '../../shared/svg/scaffold.js';
import { aggregateCategories } from '../../shared/categoryAggregation.js';
import { normalizeTreemapOptions } from '../options.js';

/** @private */
function truncate(text, maxLen) {
	return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

/**
 * Render a treemap into `container`. This renderer returns a plain Result
 * object rather than using the shared `ok()`/`fail()` factories.
 *
 * Common config keys: `measureMode` ('count' | 'sum' | 'mean'), `valueColumn`,
 * `topN`, `padding`, `showLabels`/`showValues`, `colorMode` ('scheme' |
 * 'uniform'), `colorScheme`, `color`, `customTitle`, and `chartHeight`.
 * The separate context supplies locale, filter callbacks and localized labels;
 * `labels.measure` names the measure in the tooltip.
 *
 * @param {HTMLElement} container - Target DOM element. Existing contents are replaced.
 * @param {Array<Object<string, *>>} rows - Source rows.
 * @param {Object} config - Stored chart config, normalized once inside the renderer.
 * @param {Object} context - Localized labels, locale, and runtime callbacks from presentation.
 * @returns {Result}
 */
export function renderTreemap(container, rows, config = {}, context = {}) {
	const { category: categoryColumn } = config;
	const { labels = {}, locale, filterCallbacks, currencies = {} } = context;
	if (!container || !categoryColumn) return { ok: false };

	const {
		measureMode,
		valueColumn,
		topN,
		padding,
		showLabels,
		showValues,
		customTitle,
		chartHeight,
		colorMode,
		colorScheme,
		uniformColor,
	} = normalizeTreemapOptions(config);

	const aggregated = aggregateCategories(rows, categoryColumn, {
		measureMode, valueColumn, positiveOnly: true, topN, missingLabel: labels.missing,
	});
	if (!aggregated.ok) return aggregated;
	const { entries, retainedValueTotal } = aggregated;
	for (const item of entries) item.label = formatCurrencyCategory(item.label, currencies.category, locale);

	container.replaceChildren();
	hideChartTooltip();

	const width = resolveChartWidth(container, CHART_DIMENSIONS.bar?.width || 700);
	let titleOffset = customTitle ? 24 : 0;
	const height = chartHeight;

	const svg = select(container)
		.append('svg')
		.attr('width', width)
		.attr('height', height)
		.attr('viewBox', `0 0 ${width} ${height}`);

	if (customTitle) {
		const title = appendChartTitle(svg, { width, text: customTitle });
		titleOffset += Math.max(0, title.selectAll('tspan').size() - 1) * 16;
	}

	const treemapWidth = width;
	const treemapHeight = height - titleOffset;

	const rootData = {
		key: 'root',
		children: entries,
	};

	const root = hierarchy(rootData)
		.sum(d => d.value)
		.sort((a, b) => b.value - a.value);

	const layoutFn = treemap()
		.tile(treemapSquarify)
		.size([treemapWidth, treemapHeight])
		.padding(padding)
		.round(true);

	layoutFn(root);

	const schemeColors = CHART_COLOR_PALETTES[colorScheme];
	const getColor = (d, i) => {
		if (colorMode === 'uniform') return uniformColor;
		return schemeColors[i % schemeColors.length];
	};

	const buildTooltipContent = (d, pct) => {
		const wrapper = document.createElement('div');

		wrapper.appendChild(createTooltipLine(labels.category, d.data.label));
		wrapper.appendChild(createTooltipLine(labels.measure, formatNumber(d.data.value, locale, currencies.measure)));
		wrapper.appendChild(createTooltipLine(labels.percentage, `${pct.toFixed(1)}%`));
		return wrapper;
	};

	const leaves = root.leaves();

	const cellGroup = svg
		.append('g')
		.attr('transform', `translate(0,${titleOffset})`);

	const cells = cellGroup
		.selectAll('g')
		.data(leaves)
		.enter()
		.append('g')
		.attr('transform', d => `translate(${d.x0},${d.y0})`);

	cells
		.append('rect')
		.attr('width', d => Math.max(0, d.x1 - d.x0))
		.attr('height', d => Math.max(0, d.y1 - d.y0))
		.attr('rx', 2)
		.attr('fill', (d, i) => getColor(d, i))
		.attr('opacity', 0.88)
		.attr('stroke', '#fffef9')
		.attr('stroke-width', 1)
		.style('cursor', 'pointer')
		.on('mouseenter', (event, d) => {
			const pct = retainedValueTotal > 0 ? (d.data.value / retainedValueTotal) * 100 : 0;
			showChartTooltip(buildTooltipContent(d, pct), event.pageX, event.pageY);
		})
		.on('mousemove', event => {
			moveChartTooltip(event.pageX, event.pageY);
		})
		.on('mouseleave', () => {
			hideHoverTooltip();
		})
		.on('click', (event, d) => {
			event.stopPropagation();
			const pct = retainedValueTotal > 0 ? (d.data.value / retainedValueTotal) * 100 : 0;
			togglePinnedFilterTooltip(buildTooltipContent(d, pct), event.pageX, event.pageY, {
				target: event.currentTarget,
				headerTitle: d.data.label,
				closeLabel: labels.close,
				filterActionLabels: labels.filterActions,
				filterCallbacks,
				categories: [{ column: categoryColumn, token: d.data.token }],
			});
		});

	if (showLabels || showValues) {
		cells.each(function(d) {
			const w = d.x1 - d.x0;
			const h = d.y1 - d.y0;
			if (w < 24 || h < 14) return;

			const g = select(this);
			const cx = w / 2;

			if (showLabels && showValues && h >= 32) {
				g.append('text')
					.attr('x', cx)
					.attr('y', h / 2 - 7)
					.attr('text-anchor', 'middle')
					.attr('dominant-baseline', 'middle')
					.attr('font-size', clamp(Math.min(w / 6, h / 4, 13), 8, 13))
					.attr('fill', '#fffef9')
					.attr('pointer-events', 'none')
					.text(truncate(d.data.label, Math.max(3, Math.floor(w / 7))));

				g.append('text')
					.attr('x', cx)
					.attr('y', h / 2 + 8)
					.attr('text-anchor', 'middle')
					.attr('dominant-baseline', 'middle')
					.attr('font-size', clamp(Math.min(w / 7, h / 5, 11), 7, 11))
					.attr('fill', 'rgba(255,254,249,0.8)')
					.attr('pointer-events', 'none')
					.text(formatNumber(d.data.value, locale, currencies.measure));
			} else if (showLabels) {
				g.append('text')
					.attr('x', cx)
					.attr('y', h / 2)
					.attr('text-anchor', 'middle')
					.attr('dominant-baseline', 'middle')
					.attr('font-size', clamp(Math.min(w / 6, h / 4, 13), 8, 13))
					.attr('fill', '#fffef9')
					.attr('pointer-events', 'none')
					.text(truncate(d.data.label, Math.max(3, Math.floor(w / 7))));
			} else if (showValues) {
				g.append('text')
					.attr('x', cx)
					.attr('y', h / 2)
					.attr('text-anchor', 'middle')
					.attr('dominant-baseline', 'middle')
					.attr('font-size', clamp(Math.min(w / 7, h / 4, 12), 7, 12))
					.attr('fill', '#fffef9')
					.attr('pointer-events', 'none')
					.text(formatNumber(d.data.value, locale, currencies.measure));
			}
		});
	}

	svg.on('click', () => {
		hideChartTooltip();
	});

	return { ok: true };
}
