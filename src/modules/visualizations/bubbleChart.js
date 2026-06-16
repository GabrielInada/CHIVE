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
 * @typedef {import('../../types.js').Result} Result
 */

import { hierarchy, pack, scaleOrdinal, select } from '../../../vendor/d3/d3.js';
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
import { BUBBLE_CHART, CHART_COLOR_PALETTES, CHART_DIMENSIONS } from '../../config/charts.js';
import { formatNumber, isNullish } from '../../utils/formatters.js';
import { toCategoryToken } from '../../utils/chartFilters.js';
import { ok, fail } from '../../utils/result.js';
import { setupChartSvg } from './chartScaffold.js';
import {
	resolveNestingColumns,
	aggregateBubbles,
	buildMultiLevelHierarchy,
	getTopLevelGroup,
	isIntermediate,
	isDescendantOf,
} from './bubbleChartHierarchy.js';

/** @private */
function getBubblePalette(colorScheme) {
	return CHART_COLOR_PALETTES[colorScheme] || CHART_COLOR_PALETTES.Tableau10;
}

/**
 * Render a bubble chart into `container`. Returns `ok()` on success, or
 * `fail()` when `categoryColumn` is missing, when sum/mean aggregation
 * is requested without a usable `valueColumn`, or when no rows remain
 * after aggregation.
 *
 * Common option keys: `measureMode` ('count' | 'sum' | 'mean'),
 * `valueColumn`, `topN`, `padding`, `labelMode` ('all' | 'hover' | 'auto'),
 * `nestingMode` ('flat' | 'grouped'), `nestingColumns` (progressive
 * hierarchy column names), `groupColumn` (legacy single-group fallback),
 * `colorScheme`, `customTitle`, `chartHeight`, `locale`, and the localized
 * `labels` bag.
 *
 * @param {HTMLElement} container - Target DOM element. Existing contents are replaced.
 * @param {Array<Object<string, *>>} rows - Source rows.
 * @param {string} categoryColumn - Root category column name (required).
 * @param {Object} [options={}] - Render options bag.
 * @returns {Result}
 */
export function renderBubbleChart(container, rows, categoryColumn, options = {}) {
	if (!container || !categoryColumn) return fail();

	const measureMode = BUBBLE_CHART.measureModes.includes(options.measureMode)
		? options.measureMode
		: BUBBLE_CHART.defaultMeasureMode;
	const valueColumn = options.valueColumn || null;
	const topN = Number.isFinite(Number(options.topN)) ? Number(options.topN) : BUBBLE_CHART.defaultTopN;
	const padding = Number.isFinite(Number(options.padding))
		? Number(options.padding)
		: BUBBLE_CHART.defaultPadding;
	const labelMode = BUBBLE_CHART.labelModes.includes(options.labelMode)
		? options.labelMode
		: BUBBLE_CHART.defaultLabelMode;
	const autoLabelMinRadius = Number.isFinite(Number(options.autoLabelMinRadius))
		? Number(options.autoLabelMinRadius)
		: BUBBLE_CHART.autoLabelMinRadius;
	const parentLabelMinRadius = BUBBLE_CHART.parentLabelMinRadius;
	const nestingMode = BUBBLE_CHART.nestingModes.includes(options.nestingMode)
		? options.nestingMode
		: BUBBLE_CHART.defaultNestingMode;
	const nestingColumns = resolveNestingColumns(options);
	const locale = options.locale || undefined;
	const customTitle = String(options.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(options.chartHeight))
		? Math.max(400, Math.min(900, Number(options.chartHeight)))
		: CHART_DIMENSIONS.bubble.height;
	const colorScheme = String(options.colorScheme || '').trim() || 'Tableau10';
	const labels = {
		category: options.labels?.category || 'Category',
		count: options.labels?.count || 'Count',
		sum: options.labels?.sum || 'Sum',
		mean: options.labels?.mean || 'Mean',
		group: options.labels?.group || 'Group',
		children: options.labels?.children || 'Children',
		level: options.labels?.level || 'Level',
	};

	if (nestingMode === 'grouped' && nestingColumns.length === 0) {
		// Backward compat: also check legacy groupColumn
		if (!options.groupColumn) {
			return fail('no-nesting-columns');
		}
	}

	const aggregation = aggregateBubbles({
		rows: rows,
		categoryColumn: categoryColumn,
		measureMode,
		valueColumn,
		nestingColumns,
		topN,
	});
	if (aggregation.reason) return fail(aggregation.reason);
	const bubbles = aggregation.bubbles;

	if (bubbles.length === 0) {
		return fail();
	}

	const width = Math.max(container.clientWidth || CHART_DIMENSIONS.bubble.width, 320);
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
		colorDomain = root.children.map(c => c.data.groupName || 'N/A');
	} else {
		colorDomain = Array.from(new Set(leaves.map(item => item.data.group)));
	}
	const colorScale = scaleOrdinal(getBubblePalette(colorScheme)).domain(colorDomain);

	let pinnedNode = null;
	const filterCallbacks = options.filterCallbacks || {};
	const filterLabels = filterCallbacks.filterActionLabels || {};
	const actionLabels = {
		focus: filterLabels.focus || 'Show only this',
		add: filterLabels.add || 'Add to filter',
		exclude: filterLabels.exclude || 'Hide this',
		remove: filterLabels.remove || 'Remove from filter',
		bringBack: filterLabels.bringBack || 'Bring back',
	};

	const buildPinnedFilterTooltip = (event, content, headerTitle, filterColumn, rawValue, onDismiss) => {
		if (!filterColumn || isNullish(rawValue) || rawValue === '') {
			showPinnedChartTooltip(content, event.pageX, event.pageY, {
				headerTitle,
				closeLabel: filterLabels.close,
				onDismiss,
				actionSets: [],
			});
			return;
		}
		const token = toCategoryToken(rawValue);
		const state = typeof filterCallbacks.getTokenFilterState === 'function'
			? filterCallbacks.getTokenFilterState(filterColumn, token)
			: null;
		const omitFocus = typeof filterCallbacks.isShowOnlyThisRedundant === 'function'
			? !!filterCallbacks.isShowOnlyThisRedundant(filterColumn, token)
			: false;
		const actions = buildCategoricalFilterActions({
			column: filterColumn,
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
			headerTitle,
			closeLabel: filterLabels.close,
			onDismiss,
			actionSets: actionSet ? [actionSet] : [],
			stateBadge,
		});
	};

	const resolveParentColumn = (item) => {
		if (!item || typeof item.depth !== 'number') return null;
		if (item.depth < 1) return null;
		if (Array.isArray(nestingColumns) && nestingColumns.length > 0) {
			return nestingColumns[item.depth - 1] || null;
		}
		return null;
	};

	const zoomStack = [];
	const zoomDuration = Number.isFinite(Number(options.zoomTransitionDuration))
		? Number(options.zoomTransitionDuration)
		: BUBBLE_CHART.zoomTransitionDuration;
	const zoomPadding = BUBBLE_CHART.zoomScalePadding;

	/**
	 * Get color for any node by resolving its top-level ancestor.
	 */
	function getNodeColor(node) {
		const topGroup = getTopLevelGroup(node);
		return colorScale(topGroup);
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
				.text(String(d.data.groupName));
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
					.text(String(d.data.category));
			} else {
				textEl
					.attr('y', d.r + fontSize + 2)
					.attr('dominant-baseline', 'hanging')
					.attr('fill', '#3f3a33')
					.text(String(d.data.category));
			}
		});
	}

	function applyZoom(targetNode) {
		pinnedNode = null;
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
		pinnedNode = null;
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

	const measureLabel = measureMode === 'mean'
		? labels.mean
		: measureMode === 'sum'
			? labels.sum
			: labels.count;

	const createLeafTooltip = item => {
		const wrapper = document.createElement('div');
		wrapper.appendChild(createTooltipLine(labels.category, item.data.category));
		wrapper.appendChild(createTooltipLine(measureLabel, formatNumber(item.data.value, locale)));
		if (isGrouped) {
			wrapper.appendChild(createTooltipLine(labels.group, getTopLevelGroup(item)));
		}
		return wrapper;
	};

	const createParentTooltip = item => {
		const wrapper = document.createElement('div');
		wrapper.appendChild(createTooltipLine(labels.group, item.data.groupName));
		wrapper.appendChild(createTooltipLine(measureLabel, formatNumber(item.value, locale)));
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
				if (pinnedNode !== null) return;
				if (zoomStack.length === 0) {
					select(this).select('circle')
						.attr('fill-opacity', 0.25)
						.attr('stroke-opacity', 0.8);
				}
				showChartTooltip(createParentTooltip(item), event.pageX, event.pageY);
			})
			.on('mousemove', event => {
				if (pinnedNode !== null) return;
				moveChartTooltip(event.pageX, event.pageY);
			})
			.on('mouseleave', function onParentLeave(event, item) {
				if (pinnedNode !== null) return;
				if (zoomStack.length === 0) {
					select(this).select('circle')
						.attr('fill-opacity', Math.max(0.08, 0.18 - item.depth * 0.03))
						.attr('stroke-opacity', Math.max(0.3, 0.6 - item.depth * 0.1));
				}
				hideChartTooltip();
			})
			.on('click', (event, item) => {
				event.stopPropagation();
				if (pinnedNode === item) {
					pinnedNode = null;
					hideChartTooltip();
					return;
				}
				pinnedNode = item;
				const parentColumn = resolveParentColumn(item);
				buildPinnedFilterTooltip(
					event,
					createParentTooltip(item),
					String(item.data.groupName),
					parentColumn,
					item.data.groupName,
					() => {
						pinnedNode = null;
						hideChartTooltip();
					},
				);
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
			`${labels.category}: ${d.data.category}`,
			`${measureLabel}: ${formatNumber(d.data.value, locale)}`,
		];
		if (isGrouped) {
			lines.push(`${labels.group}: ${getTopLevelGroup(d)}`);
		}
		return lines.join('\n');
	});

	node.append('circle')
		.attr('r', d => d.r)
		.attr('fill', d => isGrouped ? getNodeColor(d) : colorScale(d.data.group))
		.attr('fill-opacity', 0.7)
		.attr('stroke', '#fff')
		.attr('stroke-width', 1);

	renderLeafLabels(1);

	const showLeafTooltip = (event, item) => {
		showChartTooltip(createLeafTooltip(item), event.pageX, event.pageY);
	};

	node
		.on('mouseenter', (event, item) => {
			if (pinnedNode !== null) return;
			showLeafTooltip(event, item);
		})
		.on('mousemove', event => {
			if (pinnedNode !== null) return;
			moveChartTooltip(event.pageX, event.pageY);
		})
		.on('mouseleave', () => {
			if (pinnedNode !== null) return;
			hideChartTooltip();
		})
		.on('click', (event, item) => {
			event.stopPropagation();
			if (pinnedNode === item) {
				pinnedNode = null;
				hideChartTooltip();
				return;
			}
			pinnedNode = item;
			buildPinnedFilterTooltip(
				event,
				createLeafTooltip(item),
				String(item.data.category),
				categoryColumn,
				item.data.category,
				() => {
					pinnedNode = null;
					hideChartTooltip();
				},
			);
		});

	svg.on('click', () => {
		if (zoomStack.length > 0) {
			// Pop one level
			zoomStack.pop();
			zoomToStackTop();
			return;
		}
		pinnedNode = null;
		hideChartTooltip();
	});

	return ok();
}
