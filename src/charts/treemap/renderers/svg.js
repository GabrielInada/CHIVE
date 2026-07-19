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

import { hierarchy, select, treemap, treemapSquarify } from '../../../../vendor/d3/d3.js';
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
import { CHART_DIMENSIONS } from '../../../config/charts.js';
import { formatNumber, clamp } from '../../../utils/formatters.js';
import { toCategoryToken } from '../../../domain/filters/chartFilter.js';
import { appendChartTitle } from '../../shared/svg/scaffold.js';
import { normalizeTreemapOptions } from '../options.js';
import { aggregateTreemapData } from '../data.js';

const COLOR_PALETTE = {
	Bold: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'],
	Pastel: ['#FFB3BA', '#FFCCCB', '#FFFFBA', '#BAE1BA', '#BAC7FF', '#E0BBE4', '#FFDFD3', '#DFF8EB'],
	'Colorblind-Safe': ['#0173B2', '#029E73', '#ECE133', '#CC78BC', '#CA9161', '#949494', '#ECE2F0', '#A6ACAF'],
};

/** @private */
function getSchemeColors(schemeName) {
	return COLOR_PALETTE[schemeName] || COLOR_PALETTE['Bold'];
}

/** @private */
function truncate(text, maxLen) {
	return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

/**
 * Render a treemap into `container`. This renderer returns a plain Result
 * object rather than using the shared `ok()`/`fail()` factories.
 *
 * Common option keys: `measureMode` ('count' | 'sum'), `valueColumn`,
 * `topN`, `padding`, `showLabels`/`showValues`, `colorMode` ('scheme' |
 * 'uniform'), `colorScheme`, `color`, `customTitle`, `chartHeight`,
 * `locale`.
 *
 * @param {HTMLElement} container - Target DOM element. Existing contents are replaced.
 * @param {Array<Object<string, *>>} rows - Source rows.
 * @param {string} categoryColumn - Categorical column name (required).
 * @param {Object} [options={}] - Render options bag.
 * @returns {Result}
 */
export function renderTreemap(container, rows, categoryColumn, options = {}) {
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
		locale,
		labels,
	} = normalizeTreemapOptions(options);

	const aggregated = aggregateTreemapData(rows, categoryColumn, { measureMode, valueColumn, topN });
	if (!aggregated.ok) return aggregated;
	const { entries, total } = aggregated;

	container.replaceChildren();
	hideChartTooltip();

	const width = Math.max(container.clientWidth || CHART_DIMENSIONS.bar?.width || 700, 320);
	const titleOffset = customTitle ? 24 : 0;
	const height = chartHeight;

	const svg = select(container)
		.append('svg')
		.attr('width', width)
		.attr('height', height);

	if (customTitle) {
		appendChartTitle(svg, { width, text: customTitle });
	}

	const treemapWidth = width;
	const treemapHeight = height - titleOffset;

	const rootData = {
		name: 'root',
		children: entries.map(([name, value]) => ({ name, value })),
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

	const schemeColors = getSchemeColors(colorScheme);
	const getColor = (d, i) => {
		if (colorMode === 'uniform') return uniformColor;
		return schemeColors[i % schemeColors.length];
	};

	let pinnedName = null;
	const filterCallbacks = options.filterCallbacks || {};
	const filterLabels = filterCallbacks.filterActionLabels || {};
	const actionLabels = {
		focus: filterLabels.focus || labels.focusOnThis,
		add: filterLabels.add || labels.addToFilter,
		exclude: filterLabels.exclude || 'Hide this',
		remove: filterLabels.remove || 'Remove from filter',
		bringBack: filterLabels.bringBack || 'Bring back',
	};

	const buildTooltipContent = (d, pct) => {
		const wrapper = document.createElement('div');
		const valueLabel = measureMode === 'sum' ? labels.sum : labels.count;

		wrapper.appendChild(createTooltipLine(labels.category, String(d.data.name)));
		wrapper.appendChild(createTooltipLine(valueLabel, formatNumber(d.data.value, locale)));
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
			if (pinnedName !== null) return;
			const pct = total > 0 ? (d.data.value / total) * 100 : 0;
			showChartTooltip(buildTooltipContent(d, pct), event.pageX, event.pageY);
		})
		.on('mousemove', event => {
			if (pinnedName !== null) return;
			moveChartTooltip(event.pageX, event.pageY);
		})
		.on('mouseleave', () => {
			if (pinnedName !== null) return;
			hideChartTooltip();
		})
		.on('click', (event, d) => {
			event.stopPropagation();
			if (pinnedName === d.data.name) {
				pinnedName = null;
				hideChartTooltip();
				return;
			}
			pinnedName = d.data.name;
			const pct = total > 0 ? (d.data.value / total) * 100 : 0;
			const content = buildTooltipContent(d, pct);
			const token = toCategoryToken(d.data.name);
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
				headerTitle: String(d.data.name),
				closeLabel: filterLabels.close,
				onDismiss: () => {
					pinnedName = null;
					hideChartTooltip();
				},
				actionSets: actionSet ? [actionSet] : [],
				stateBadge,
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
					.text(truncate(d.data.name, Math.max(3, Math.floor(w / 7))));

				g.append('text')
					.attr('x', cx)
					.attr('y', h / 2 + 8)
					.attr('text-anchor', 'middle')
					.attr('dominant-baseline', 'middle')
					.attr('font-size', clamp(Math.min(w / 7, h / 5, 11), 7, 11))
					.attr('fill', 'rgba(255,254,249,0.8)')
					.attr('pointer-events', 'none')
					.text(formatNumber(d.data.value, locale));
			} else if (showLabels) {
				g.append('text')
					.attr('x', cx)
					.attr('y', h / 2)
					.attr('text-anchor', 'middle')
					.attr('dominant-baseline', 'middle')
					.attr('font-size', clamp(Math.min(w / 6, h / 4, 13), 8, 13))
					.attr('fill', '#fffef9')
					.attr('pointer-events', 'none')
					.text(truncate(d.data.name, Math.max(3, Math.floor(w / 7))));
			} else if (showValues) {
				g.append('text')
					.attr('x', cx)
					.attr('y', h / 2)
					.attr('text-anchor', 'middle')
					.attr('dominant-baseline', 'middle')
					.attr('font-size', clamp(Math.min(w / 7, h / 4, 12), 7, 12))
					.attr('fill', '#fffef9')
					.attr('pointer-events', 'none')
					.text(formatNumber(d.data.value, locale));
			}
		});
	}

	svg.on('click', () => {
		pinnedName = null;
		hideChartTooltip();
	});

	return { ok: true };
}
