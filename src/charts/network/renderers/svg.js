/**
 * Network-graph renderer.
 *
 * Builds a D3 force-directed graph from row-encoded edges. Nodes are
 * derived from the union of source/target columns; edge weights and node
 * groups are optional accessors. Supports pan/zoom and node drag.
 *
 * The simulation instance is cached on the container under
 * `SIMULATION_KEY` so re-renders can reuse the same force layout (avoids
 * the visual jump that a fresh simulation would cause).
 *
 * Internal D3 helpers (force setup, drag handlers, zoom integration) are
 * intentionally undocumented per the Tier 5 plan.
 *
 * @typedef {import('../../../types.js').Result} Result
 */

import {
	forceCenter,
	forceLink,
	forceManyBody,
	forceSimulation,
	select,
	drag,
	zoom,
	zoomIdentity,
} from '../../../../vendor/d3/d3.js';
import {
	buildCategoricalFilterActions,
	createFilterStateBadge,
	createTooltipActionGroup,
	createTooltipLine,
	hideChartTooltip,
	moveChartTooltip,
	repositionPinnedTooltip,
	showChartTooltip,
	showPinnedChartTooltip,
} from '../../shared/tooltip/tooltip.js';
import { toCategoryToken } from '../../../utils/chartFilters.js';
import { CHART_DIMENSIONS, NETWORK_GRAPH } from '../../../config/charts.js';
import { formatNumber, isNullish } from '../../../utils/formatters.js';
import { interpolateColor, isValidHexColor } from '../../../utils/colorUtils.js';
import { fail } from '../../../utils/result.js';
import { appendChartTitle } from '../../shared/svg/scaffold.js';
import { buildNetworkData } from '../data.js';

const SIMULATION_KEY = '__chive_network_simulation__';
let gradientRenderCounter = 0;

function stopPreviousSimulation(container) {
	const previous = container?.[SIMULATION_KEY];
	if (previous && typeof previous.stop === 'function') {
		previous.stop();
	}
	if (container) {
		container[SIMULATION_KEY] = null;
	}
}

/**
 * Render a network graph into `container`. Returns `ok()` on success, or
 * `fail()` when required arguments are missing or no edges resolve from
 * the data.
 *
 * Common option keys: `weight` (numeric column for edge thickness), `group`
 * (categorical column for node coloring), `nodeRadius`, `linkDistance`,
 * `chargeStrength`, `linkOpacity`, `zoomScale`, `alphaDecay`,
 * `showNodeLabels`, `showLegend`, color and palette inputs, axis-style
 * inputs, `customTitle`, `chartHeight`, `locale`.
 *
 * @param {HTMLElement} container - Target DOM element. Existing contents are replaced.
 * @param {Array<Object<string, *>>} rows - Source rows (one row per edge).
 * @param {string} sourceColumn - Column holding the source node identifier.
 * @param {string} targetColumn - Column holding the target node identifier.
 * @param {Object} [options={}] - Render options bag.
 * @returns {Result}
 */
export function renderNetworkGraph(container, rows, sourceColumn, targetColumn, options = {}) {
	if (!container || !sourceColumn || !targetColumn) return fail();

	const weightColumn = options.weightColumn || null;
	const groupColumn = options.groupColumn || null;
	const nodeRadius = Number.isFinite(Number(options.nodeRadius)) ? Number(options.nodeRadius) : 5;
	const linkOpacity = Number.isFinite(Number(options.linkOpacity)) ? Number(options.linkOpacity) : 0.45;
	const chargeStrength = Number.isFinite(Number(options.chargeStrength)) ? Number(options.chargeStrength) : -80;
	const linkDistance = Number.isFinite(Number(options.linkDistance)) ? Number(options.linkDistance) : 46;
	const zoomScale = Number.isFinite(Number(options.zoomScale))
		? Number(options.zoomScale)
		: NETWORK_GRAPH.defaultZoomScale;
	const alphaDecay = Number.isFinite(Number(options.alphaDecay))
		? Number(options.alphaDecay)
		: NETWORK_GRAPH.defaultAlphaDecay;
	const showLegend = options.showLegend !== false;
	const showNodeLabels = options.showNodeLabels === true;
	const sourceNodeColor = isValidHexColor(String(options.sourceNodeColor || '').trim())
		? String(options.sourceNodeColor).trim()
		: '#e3743d';
	const targetNodeColor = isValidHexColor(String(options.targetNodeColor || '').trim())
		? String(options.targetNodeColor).trim()
		: '#6b94c9';
	const edgeColorMode = options.edgeColorMode === 'uniform' ? 'uniform' : 'gradient';
	const customTitle = String(options.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(options.chartHeight))
		? Math.max(220, Math.min(720, Number(options.chartHeight)))
		: 420;
	const locale = options.locale || undefined;
	const labels = {
		node: options.labels?.node || 'Node',
		linkWeight: options.labels?.linkWeight || 'Weight',
		source: options.labels?.source || 'Source',
		target: options.labels?.target || 'Target',
	};

	const network = buildNetworkData(rows, sourceColumn, targetColumn, weightColumn, groupColumn);
	if (network.nodes.length === 0 || network.links.length === 0) {
		return fail('insufficient-data');
	}
	const gradientPrefix = `network-link-gradient-${++gradientRenderCounter}`;

	container.replaceChildren();
	hideChartTooltip();
	stopPreviousSimulation(container);

	const width = Math.max(container.clientWidth || CHART_DIMENSIONS.scatter.width, 320);
	const height = chartHeight;

	const svg = select(container)
		.append('svg')
		.attr('width', width)
		.attr('height', height)
		.attr('viewBox', [-(width / 2), -(height / 2), width, height]);

	const viewport = svg.append('g');

	if (customTitle) {
		appendChartTitle(svg, {
			width,
			text: customTitle,
			x: 0,
			y: -(height / 2) + 18,
		});
	}

	const links = network.links.map(link => ({ ...link }));
	const nodes = network.nodes.map(node => ({ ...node }));
	const sourceNodeIds = new Set(network.links.map(link => String(link.source)));
	const targetNodeIds = new Set(network.links.map(link => String(link.target)));
	const getNodeColor = (nodeData) => {
		const isSource = sourceNodeIds.has(String(nodeData.id));
		const isTarget = targetNodeIds.has(String(nodeData.id));
		if (isSource && isTarget) return interpolateColor(sourceNodeColor, targetNodeColor, 0.5);
		if (isSource) return sourceNodeColor;
		if (isTarget) return targetNodeColor;
		return interpolateColor(sourceNodeColor, targetNodeColor, 0.5);
	};

	const simulation = forceSimulation(nodes)
		.force('link', forceLink(links).id(node => node.id).distance(linkDistance))
		.force('charge', forceManyBody().strength(chargeStrength))
		.alphaDecay(Math.min(Math.max(alphaDecay, NETWORK_GRAPH.minAlphaDecay), NETWORK_GRAPH.maxAlphaDecay))
		.force('center', forceCenter(0, 0));

	container[SIMULATION_KEY] = simulation;

	let pinnedNodeDatum = null;
	const filterCallbacks = options.filterCallbacks || {};
	const filterLabels = filterCallbacks.filterActionLabels || {};
	const actionLabels = {
		focus: filterLabels.focus || 'Show only this',
		add: filterLabels.add || 'Add to filter',
		exclude: filterLabels.exclude || 'Hide this',
		remove: filterLabels.remove || 'Remove from filter',
		bringBack: filterLabels.bringBack || 'Bring back',
	};

	const buildNodeTooltipContent = (nodeData) => {
		const content = document.createElement('div');
		content.appendChild(createTooltipLine(labels.node, nodeData.id));
		return content;
	};

	const buildNodeActionSet = (column, rawValue, headingLabel) => {
		if (!column || isNullish(rawValue) || rawValue === '') return null;
		const token = toCategoryToken(rawValue);
		const state = typeof filterCallbacks.getTokenFilterState === 'function'
			? filterCallbacks.getTokenFilterState(column, token)
			: null;
		const omitFocus = typeof filterCallbacks.isShowOnlyThisRedundant === 'function'
			? !!filterCallbacks.isShowOnlyThisRedundant(column, token)
			: false;
		const actions = buildCategoricalFilterActions({
			column,
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
		if (actions.length === 0) return null;
		const wrap = document.createElement('div');
		wrap.className = 'chart-tooltip__action-set-wrap';
		if (headingLabel) {
			const heading = document.createElement('div');
			heading.className = 'chart-tooltip__action-set-label';
			heading.textContent = headingLabel;
			wrap.appendChild(heading);
		}
		wrap.appendChild(createTooltipActionGroup(actions));
		return { node: wrap, state };
	};
	const showNodeTooltip = (event, nodeData) => {
		showChartTooltip(buildNodeTooltipContent(nodeData), event.pageX, event.pageY);
	};
	const nodeScreenPoint = (nodeData) => {
		if (!nodeData) return null;
		const svgNode = svg.node();
		const viewportNode = viewport.node();
		if (!svgNode || !viewportNode) return null;
		const ctm = typeof viewportNode.getScreenCTM === 'function'
			? viewportNode.getScreenCTM()
			: null;
		if (!ctm) return null;
		let screen;
		if (typeof svgNode.createSVGPoint === 'function') {
			const pt = svgNode.createSVGPoint();
			pt.x = Number(nodeData.x) || 0;
			pt.y = Number(nodeData.y) || 0;
			screen = pt.matrixTransform(ctm);
		} else {
			screen = {
				x: ctm.a * (Number(nodeData.x) || 0) + ctm.c * (Number(nodeData.y) || 0) + ctm.e,
				y: ctm.b * (Number(nodeData.x) || 0) + ctm.d * (Number(nodeData.y) || 0) + ctm.f,
			};
		}
		return {
			x: screen.x + (typeof window !== 'undefined' ? window.scrollX : 0),
			y: screen.y + (typeof window !== 'undefined' ? window.scrollY : 0),
		};
	};

	const defs = svg.append('defs');
	const link = viewport
		.append('g')
		.attr('stroke-opacity', linkOpacity)
		.selectAll('line')
		.data(links)
		.enter()
		.append('line')
		.each(function setGradientId(d, index) {
			d._gradientId = `${gradientPrefix}-${index}`;
		})
		.attr('stroke', d => {
			if (edgeColorMode === 'uniform') return '#7d7d7d';
			return `url(#${d._gradientId})`;
		})
		.attr('stroke-width', d => Math.max(1, Math.sqrt(Number(d.value) || 1)))
		.on('mouseenter', (event, linkData) => {
			const content = document.createElement('div');
			content.appendChild(createTooltipLine(labels.source, String(linkData.source.id || linkData.source)));
			content.appendChild(createTooltipLine(labels.target, String(linkData.target.id || linkData.target)));
			content.appendChild(createTooltipLine(labels.linkWeight, formatNumber(Number(linkData.value) || 0, locale)));
			showChartTooltip(content, event.pageX, event.pageY);
		})
		.on('mousemove', event => {
			moveChartTooltip(event.pageX, event.pageY);
		})
		.on('mouseleave', () => {
			hideChartTooltip();
		});

	const node = viewport
		.append('g')
		.attr('stroke', '#fff')
		.attr('stroke-width', 1.2)
		.selectAll('circle')
		.data(nodes)
		.enter()
		.append('circle')
		.attr('r', nodeRadius)
		.attr('fill', d => getNodeColor(d))
		.on('mouseenter', (event, nodeData) => {
			if (pinnedNodeDatum !== null) return;
			showNodeTooltip(event, nodeData);
		})
		.on('mousemove', event => {
			if (pinnedNodeDatum !== null) return;
			moveChartTooltip(event.pageX, event.pageY);
		})
		.on('mouseleave', () => {
			if (pinnedNodeDatum !== null) return;
			hideChartTooltip();
		})
		.on('click', (event, nodeData) => {
			event.stopPropagation();
			if (pinnedNodeDatum && pinnedNodeDatum.id === nodeData.id) {
				pinnedNodeDatum = null;
				hideChartTooltip();
				return;
			}
			pinnedNodeDatum = nodeData;
			const anchorPoint = nodeScreenPoint(nodeData);
			const startX = anchorPoint ? anchorPoint.x : event.pageX;
			const startY = anchorPoint ? anchorPoint.y : event.pageY;

			const content = buildNodeTooltipContent(nodeData);
			const actionSets = [];
			let primaryState = null;

			if (sourceColumn && targetColumn && sourceColumn === targetColumn) {
				const set = buildNodeActionSet(sourceColumn, nodeData.id, sourceColumn);
				if (set) {
					actionSets.push(set.node);
					primaryState = set.state;
				}
			} else {
				if (sourceColumn) {
					const headingPrefix = filterLabels.filterBySource || 'Filter source';
					const set = buildNodeActionSet(sourceColumn, nodeData.id, `${headingPrefix} (${sourceColumn})`);
					if (set) {
						actionSets.push(set.node);
						primaryState = primaryState || set.state;
					}
				}
				if (targetColumn) {
					const headingPrefix = filterLabels.filterByTarget || 'Filter target';
					const set = buildNodeActionSet(targetColumn, nodeData.id, `${headingPrefix} (${targetColumn})`);
					if (set) {
						actionSets.push(set.node);
						primaryState = primaryState || set.state;
					}
				}
			}

			const stateBadge = actionSets.length === 1 && primaryState
				? createFilterStateBadge({
					state: primaryState,
					includedLabel: filterLabels.stateIncluded,
					excludedLabel: filterLabels.stateExcluded,
				})
				: null;

			showPinnedChartTooltip(content, startX, startY, {
				headerTitle: String(nodeData.id),
				closeLabel: filterLabels.close,
				onDismiss: () => {
					pinnedNodeDatum = null;
					hideChartTooltip();
				},
				anchor: () => nodeScreenPoint(pinnedNodeDatum),
				actionSets,
				stateBadge,
			});
		});

	svg.on('click', () => {
		pinnedNodeDatum = null;
		hideChartTooltip();
	});

	node.call(
		drag()
			.on('start', event => {
				if (!event.active) simulation.alphaTarget(0.3).restart();
				event.subject.fx = event.subject.x;
				event.subject.fy = event.subject.y;
			})
			.on('drag', event => {
				event.subject.fx = event.x;
				event.subject.fy = event.y;
			})
			.on('end', event => {
				if (!event.active) simulation.alphaTarget(0);
				event.subject.fx = null;
				event.subject.fy = null;
			})
	);

	const labelsSelection = showNodeLabels
		? viewport
			.append('g')
			.attr('class', 'network-labels')
			.selectAll('text')
			.data(nodes)
			.enter()
			.append('text')
			.attr('font-size', 10)
			.attr('fill', '#3f3a33')
			.attr('dx', nodeRadius + 2)
			.attr('dy', 3)
			.text(d => d.id)
		: null;

	const zoomBehavior = zoom()
		.scaleExtent([NETWORK_GRAPH.minZoomScale, NETWORK_GRAPH.maxZoomScale])
		.on('zoom', event => {
			viewport.attr('transform', event.transform);
			repositionPinnedTooltip();
		});

	svg.call(zoomBehavior);
	svg.call(
		zoomBehavior.transform,
		zoomIdentity.scale(Math.min(Math.max(zoomScale, NETWORK_GRAPH.minZoomScale), NETWORK_GRAPH.maxZoomScale))
	);

	if (showLegend) {
		const legend = svg
			.append('g')
			.attr('transform', `translate(${-(width / 2) + 12},${-(height / 2) + 12})`)
			.attr('class', 'network-legend');

		[
			{ label: labels.source, color: sourceNodeColor },
			{ label: labels.target, color: targetNodeColor },
		].forEach((item, index) => {
			const row = legend.append('g').attr('transform', `translate(0,${index * 14})`);
			row
				.append('rect')
				.attr('width', 8)
				.attr('height', 8)
				.attr('rx', 1)
				.attr('ry', 1)
				.attr('fill', item.color);
			row
				.append('text')
				.attr('x', 12)
				.attr('y', 7)
				.attr('font-size', 10)
				.attr('fill', '#3f3a33')
				.text(item.label);
		});
	}

	simulation.on('tick', () => {
		if (edgeColorMode === 'gradient') {
			links.forEach(d => {
				const gradient = defs.select(`#${d._gradientId}`).empty()
					? defs.append('linearGradient').attr('id', d._gradientId)
					: defs.select(`#${d._gradientId}`);

				gradient
					.attr('gradientUnits', 'userSpaceOnUse')
					.attr('x1', d.source.x)
					.attr('y1', d.source.y)
					.attr('x2', d.target.x)
					.attr('y2', d.target.y);

				gradient.selectAll('stop').remove();
				gradient.append('stop').attr('offset', '0%').attr('stop-color', sourceNodeColor);
				gradient.append('stop').attr('offset', '100%').attr('stop-color', targetNodeColor);
			});
		}

		link
			.attr('x1', d => d.source.x)
			.attr('y1', d => d.source.y)
			.attr('x2', d => d.target.x)
			.attr('y2', d => d.target.y);

		node
			.attr('cx', d => d.x)
			.attr('cy', d => d.y);

		if (labelsSelection) {
			labelsSelection
				.attr('x', d => d.x)
				.attr('y', d => d.y);
		}

		repositionPinnedTooltip();
	});

	return {
		ok: true,
		nodesCount: nodes.length,
		linksCount: links.length,
	};
}
