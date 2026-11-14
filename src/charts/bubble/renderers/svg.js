/**
 * Bubble-chart renderer.
 *
 * Renders a D3 circle-pack layout. Supports flat aggregation (one bubble
 * per category) and progressive multi-level nesting (groups of bubbles
 * inside parent bubbles). Tooltip actions filter rows on click.
 *
 * Internal D3 helpers (pack layout, label placement, palette interpolation)
 * are intentionally undocumented per the Tier 5 plan.
 *
 * @typedef {import('../../../types.js').Result} Result
 */

import { formatCurrencyCategory } from '../../shared/currency.js';
import { hierarchy, pack, scaleOrdinal, select } from '../../../../vendor/d3/d3.js';
import {
	createTooltipLine,
	hideChartTooltip,
	hideHoverTooltip,
	isTooltipPinned,
	moveChartTooltip,
	showChartTooltip,
} from '../../shared/tooltip/tooltip.js';
import { togglePinnedFilterTooltip } from '../../shared/tooltip/filterActions.js';
import { normalizeBubbleOptions } from '../options.js';
import { BUBBLE_CHART } from '../../../config/charts/definitions/bubble.js';
import { CHART_COLOR_PALETTES } from '../../../config/charts/shared.js';
import { CHART_DIMENSIONS } from '../../../config/charts/definitions.js';
import { resolveChartWidth } from '../../shared/chartWidth.js';
import { formatNumber } from '../../../utils/formatters.js';
import { ok, fail } from '../../../utils/result.js';
import { setupChartSvg } from '../../shared/svg/scaffold.js';
import {
	aggregateBubbles,
	buildMultiLevelHierarchy,
	getTopLevelGroup,
	isIntermediate,
	isDescendantOf,
} from '../data.js';

/**
 * Render a bubble chart into `container`. Returns `ok()` on success, or
 * `fail()` when `categoryColumn` is missing, when sum/mean aggregation
 * is requested without a usable `valueColumn`, or when no positive
 * category values remain after aggregation.
 *
 * Common config keys: `measureMode` ('count' | 'sum' | 'mean'),
 * `valueColumn`, `topN`, `padding`, `labelMode` ('all' | 'hover' | 'auto'),
 * `nestingMode` ('flat' | 'grouped'), `nestingColumns` (progressive
 * hierarchy column names), `groupColumn` (legacy single-group fallback),
 * `colorScheme`, `customTitle`, and `chartHeight`. The separate context supplies
 * locale, filter callbacks and localized labels; `labels.measure` names the
 * measure in tooltips and bubble titles.
 *
 * @param {HTMLElement} container - Target DOM element. Existing contents are replaced.
 * @param {Array<Object<string, *>>} rows - Source rows.
 * @param {Object} config - Stored chart config, normalized once inside the renderer.
 * @param {Object} context - Localized labels, locale, and runtime callbacks from presentation.
 * @returns {Result}
 */
export function renderBubbleChart(container, rows, config = {}, context = {}) {
	const { category: categoryColumn } = config;
	const { labels = {}, locale, filterCallbacks, currencies = {} } = context;
	if (!container || !categoryColumn) return fail();

	const {
		measureMode, labelMode, nestingMode, colorScheme, valueColumn, topN, padding,
		autoLabelMinRadius, nestingColumns, customTitle, chartHeight, zoomDuration,
	} = normalizeBubbleOptions(config);
	const parentLabelMinRadius = BUBBLE_CHART.parentLabelMinRadius;

	// Grouped mode needs at least one resolved nesting column. The resolver already
	// performs the valid legacy-groupColumn fallback, so an invalid truthy
	// groupColumn (e.g. {} or 1) leaves nestingColumns empty and must fail here
	// rather than silently rendering flat.
	if (nestingMode === 'grouped' && nestingColumns.length === 0) {
		return fail('no-nesting-columns');
	}

	const aggregation = aggregateBubbles({
		rows: rows,
		categoryColumn: categoryColumn,
		measureMode,
		valueColumn,
		nestingColumns,
		topN,
		missingLabel: labels.missing,
	});
	if (!aggregation.ok) return fail(aggregation.reason);
	const bubbles = aggregation.entries;
	for (const item of bubbles) item.label = formatCurrencyCategory(item.label, currencies.category, locale);

	for (const item of bubbles) {
		item.nestingPath.forEach((segment, index) => {
			segment.label = formatCurrencyCategory(segment.label, currencies.nesting?.[index], locale);
		});
		item.groupLabel = item.nestingPath[0]?.label || item.label;
	}

	const width = resolveChartWidth(container, CHART_DIMENSIONS.bubble.width);
	const height = chartHeight;
	const margin = CHART_DIMENSIONS.bubble.margins;
	const {
		svg,
		group: viewport,
		innerWidth,
		innerHeight,
		appliedTitleOffset: titleOffset,
	} = setupChartSvg(container, {
		width,
		height,
		margin,
		customTitle,
		viewBox: true,
	});
	hideChartTooltip();

	// Build hierarchy based on nesting mode
	let hierarchyData;
	const isGrouped = nestingMode === 'grouped' && nestingColumns.length > 0;

	if (isGrouped) {
		hierarchyData = buildMultiLevelHierarchy(bubbles, nestingColumns);
	} else {
		hierarchyData = { children: bubbles };
	}

	const maxDepth = isGrouped ? nestingColumns.length + 1 : 1;
	const root = hierarchy(hierarchyData).sum(d => d.value || 0);
	const packLayout = pack()
		.size([innerWidth, innerHeight])
		.padding(d => {
			if (!isGrouped) return Math.max(0, padding);
			if (d.depth === 0) {
				return Math.max(0, padding) + BUBBLE_CHART.shallowPaddingBoost;
			}
			if (d.depth < maxDepth - 1) {
				return Math.max(BUBBLE_CHART.deepPaddingMin, padding);
			}
			return Math.max(0, padding);
		});
	packLayout(root);

	const leaves = root.leaves();

	// Color domain: by top-level nesting group names (depth 1 children of root)
	let colorDomain;
	if (isGrouped && root.children) {
		colorDomain = root.children.map(c => c.data.groupKey);
	} else {
		colorDomain = Array.from(new Set(leaves.map(item => item.data.groupKey)));
	}
	const colorScale = scaleOrdinal(CHART_COLOR_PALETTES[colorScheme]).domain(colorDomain);

	const resolveParentColumn = (item) => {
		if (!item || typeof item.depth !== 'number') return null;
		if (item.depth < 1) return null;
		if (Array.isArray(nestingColumns) && nestingColumns.length > 0) {
			return nestingColumns[item.depth - 1] || null;
		}
		return null;
	};

	const zoomStack = [];
	const zoomPadding = BUBBLE_CHART.zoomScalePadding;

	/**
	 * Get color for any node by resolving its top-level ancestor.
	 */
	function getNodeColor(node) {
		return colorScale(getTopLevelGroup(node).key);
	}

	function renderParentLabels(scale) {
		viewport.selectAll('text.bubble-parent-label').remove();
		viewport.selectAll('g.bubble-parent').each(function renderPLabel(d) {
			const apparentR = d.r * scale;
			if (apparentR < parentLabelMinRadius) return;
			const fontSize = Math.max(10, Math.min(14, d.r / 5));
			select(this)
				.append('text')
				.attr('class', 'bubble-parent-label')
				.attr('text-anchor', 'middle')
				.attr('pointer-events', 'none')
				.attr('font-size', fontSize)
				.attr('font-weight', 600)
				.attr('y', -d.r + fontSize + 4)
				.attr('fill', '#3f3a33')
				.attr('fill-opacity', 0.7)
				.text(d.data.groupLabel);
		});
	}

	function renderLeafLabels(scale) {
		viewport.selectAll('text.bubble-leaf-label').remove();
		if (labelMode === 'hover') return;

		viewport.selectAll('g.bubble-node').each(function renderLabel(d) {
			const apparentR = d.r * scale;
			const shouldShow = labelMode === 'all' || (labelMode === 'auto' && apparentR >= autoLabelMinRadius);
			if (!shouldShow) return;

			const fitsInside = apparentR >= autoLabelMinRadius;
			const fontSize = fitsInside
				? Math.max(9, Math.min(13, d.r / 3))
				: Math.max(7, Math.min(10, d.r / 2));

			const textEl = select(this)
				.append('text')
				.attr('class', 'bubble-leaf-label')
				.attr('text-anchor', 'middle')
				.attr('pointer-events', 'none')
				.attr('font-size', fontSize);

			if (fitsInside) {
				textEl
					.attr('dominant-baseline', 'middle')
					.attr('fill', '#fff')
					.style('clip-path', `circle(${d.r}px)`)
					.text(d.data.label);
			} else {
				textEl
					.attr('y', d.r + fontSize + 2)
					.attr('dominant-baseline', 'hanging')
					.attr('fill', '#3f3a33')
					.text(d.data.label);
			}
		});
	}

	function applyZoom(targetNode) {
		hideChartTooltip();

		const scale = Math.min(innerWidth, innerHeight) / (2 * targetNode.r * zoomPadding);
		const tx = innerWidth / 2 - targetNode.x * scale;
		const ty = innerHeight / 2 - targetNode.y * scale;
		const transform = `translate(${margin.left + tx},${margin.top + titleOffset + ty}) scale(${scale})`;

		if (zoomDuration > 0) {
			viewport.transition().duration(zoomDuration).attr('transform', transform);
		} else {
			viewport.attr('transform', transform);
		}

		// Dim and disable non-descendant nodes
		viewport.selectAll('g.bubble-parent')
			.attr('opacity', d => (d === targetNode || isDescendantOf(d, targetNode)) ? 1 : 0.12)
			.style('pointer-events', d => (d === targetNode || isDescendantOf(d, targetNode)) ? 'all' : 'none');
		viewport.selectAll('g.bubble-node')
			.attr('opacity', d => isDescendantOf(d, targetNode) ? 1 : 0.12)
			.style('pointer-events', d => isDescendantOf(d, targetNode) ? 'all' : 'none');

		renderParentLabels(scale);
		renderLeafLabels(scale);
	}

	function resetZoom() {
		hideChartTooltip();
		zoomStack.length = 0;

		const transform = `translate(${margin.left},${margin.top + titleOffset})`;

		if (zoomDuration > 0) {
			viewport.transition().duration(zoomDuration).attr('transform', transform);
		} else {
			viewport.attr('transform', transform);
		}

		// Restore all
		viewport.selectAll('g.bubble-parent')
			.attr('opacity', 1)
			.style('pointer-events', 'all');
		viewport.selectAll('g.bubble-node')
			.attr('opacity', 1)
			.style('pointer-events', 'all');

		renderParentLabels(1);
		renderLeafLabels(1);
	}

	function zoomToStackTop() {
		if (zoomStack.length === 0) {
			resetZoom();
			return;
		}
		const target = zoomStack[zoomStack.length - 1];
		applyZoom(target);
	}

	const createLeafTooltip = item => {
		const wrapper = document.createElement('div');
		wrapper.appendChild(createTooltipLine(labels.category, item.data.label));
		wrapper.appendChild(createTooltipLine(labels.measure, formatNumber(item.data.value, locale, currencies.measure)));
		if (isGrouped) {
			wrapper.appendChild(createTooltipLine(labels.group, getTopLevelGroup(item).label));
		}
		return wrapper;
	};

	const createParentTooltip = item => {
		const wrapper = document.createElement('div');
		wrapper.appendChild(createTooltipLine(labels.group, item.data.groupLabel));
		wrapper.appendChild(createTooltipLine(labels.measure, formatNumber(item.value, locale, currencies.measure)));
		wrapper.appendChild(createTooltipLine(labels.children, item.children.length));
		wrapper.appendChild(createTooltipLine(labels.level, item.depth));
		return wrapper;
	};

	// Render intermediate (parent) circles at all depths in grouped mode
	if (isGrouped) {
		const intermediateNodes = root.descendants().filter(d => isIntermediate(d));
		const parentGroup = viewport
			.selectAll('g.bubble-parent')
			.data(intermediateNodes)
			.enter()
			.append('g')
			.attr('class', 'bubble-parent')
			.attr('data-depth', d => d.depth)
			.attr('transform', d => `translate(${d.x},${d.y})`);

		parentGroup.append('circle')
			.attr('r', d => d.r)
			.attr('fill', d => getNodeColor(d))
			.attr('fill-opacity', d => Math.max(0.08, 0.18 - d.depth * 0.03))
			.attr('stroke', d => getNodeColor(d))
			.attr('stroke-width', d => Math.max(0.5, 2 - d.depth * 0.4))
			.attr('stroke-opacity', d => Math.max(0.3, 0.6 - d.depth * 0.1))
			.style('cursor', 'pointer');

		renderParentLabels(1);

		parentGroup
			.on('mouseenter', function onParentEnter(event, item) {
				if (isTooltipPinned()) return;
				if (zoomStack.length === 0) {
					select(this).select('circle')
						.attr('fill-opacity', 0.25)
						.attr('stroke-opacity', 0.8);
				}
				showChartTooltip(createParentTooltip(item), event.pageX, event.pageY);
			})
			.on('mousemove', event => {
				moveChartTooltip(event.pageX, event.pageY);
			})
			.on('mouseleave', function onParentLeave(event, item) {
				if (isTooltipPinned()) return;
				if (zoomStack.length === 0) {
					select(this).select('circle')
						.attr('fill-opacity', Math.max(0.08, 0.18 - item.depth * 0.03))
						.attr('stroke-opacity', Math.max(0.3, 0.6 - item.depth * 0.1));
				}
				hideHoverTooltip();
			})
			.on('click', (event, item) => {
				event.stopPropagation();
				togglePinnedFilterTooltip(createParentTooltip(item), event.pageX, event.pageY, {
					target: event.currentTarget,
					headerTitle: item.data.groupLabel,
					closeLabel: labels.close,
					filterActionLabels: labels.filterActions,
					filterCallbacks,
					categories: [{ column: resolveParentColumn(item), token: item.data.groupToken }],
				});
			})
			.on('dblclick', (event, item) => {
				event.stopPropagation();
				if (!item.children || item.children.length === 0) return;

				// Check if this node is a descendant of current zoom target
				const currentTarget = zoomStack.length > 0 ? zoomStack[zoomStack.length - 1] : null;
				if (currentTarget && !isDescendantOf(item, currentTarget) && item !== currentTarget) {
					// Rebuild stack to this node's path
					zoomStack.length = 0;
					let node = item;
					const path = [];
					while (node.parent && node.parent.parent) {
						path.unshift(node);
						node = node.parent;
					}
					if (node.parent) path.unshift(node);
					zoomStack.push(...path);
				} else {
					// Drill deeper
					zoomStack.push(item);
				}
				applyZoom(item);
			});
	}

	// Render leaf circles
	const node = viewport
		.selectAll('g.bubble-node')
		.data(leaves)
		.enter()
		.append('g')
		.attr('class', 'bubble-node')
		.attr('transform', d => `translate(${d.x},${d.y})`);

	node.append('title').text(d => {
		const lines = [
			`${labels.category}: ${d.data.label}`,
			`${labels.measure}: ${formatNumber(d.data.value, locale, currencies.measure)}`,
		];
		if (isGrouped) {
			lines.push(`${labels.group}: ${getTopLevelGroup(d).label}`);
		}
		return lines.join('\n');
	});

	node.append('circle')
		.attr('r', d => d.r)
		.attr('fill', d => isGrouped ? getNodeColor(d) : colorScale(d.data.groupKey))
		.attr('fill-opacity', 0.7)
		.attr('stroke', '#fff')
		.attr('stroke-width', 1);

	renderLeafLabels(1);

	const showLeafTooltip = (event, item) => {
		showChartTooltip(createLeafTooltip(item), event.pageX, event.pageY);
	};

	node
		.on('mouseenter', (event, item) => {
			showLeafTooltip(event, item);
		})
		.on('mousemove', event => {
			moveChartTooltip(event.pageX, event.pageY);
		})
		.on('mouseleave', () => {
			hideHoverTooltip();
		})
		.on('click', (event, item) => {
			event.stopPropagation();
			togglePinnedFilterTooltip(createLeafTooltip(item), event.pageX, event.pageY, {
				target: event.currentTarget,
				headerTitle: item.data.label,
				closeLabel: labels.close,
				filterActionLabels: labels.filterActions,
				filterCallbacks,
				categories: [{ column: categoryColumn, token: item.data.token }],
			});
		});

	svg.on('click', () => {
		if (zoomStack.length > 0) {
			// Pop one level
			zoomStack.pop();
			zoomToStackTop();
			return;
		}
		hideChartTooltip();
	});

	return ok();
}
