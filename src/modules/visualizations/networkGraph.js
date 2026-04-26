import {
	forceCenter,
	forceLink,
	forceManyBody,
	forceSimulation,
	select,
	drag,
	zoom,
	zoomIdentity,
} from 'd3';
import { hideChartTooltip, moveChartTooltip, showChartTooltip } from './tooltip.js';
import { CHART_DIMENSIONS, NETWORK_GRAPH } from '../../config/charts.js';
import { formatNumber, isNullish } from '../../utils/formatters.js';
import { interpolateColor } from '../../utils/colorUtils.js';
import { ok, fail } from '../../utils/result.js';

const SIMULATION_KEY = '__chive_network_simulation__';

function sanitizeNodeValue(value) {
	if (isNullish(value)) return '';
	return String(value).trim();
}

function buildNetworkData(dados, sourceColumn, targetColumn, weightColumn, groupColumn) {
	const nodeMap = new Map();
	const links = [];

	dados.forEach(linha => {
		const source = sanitizeNodeValue(linha[sourceColumn]);
		const target = sanitizeNodeValue(linha[targetColumn]);
		if (!source || !target) return;

		const rawWeight = weightColumn ? Number(linha[weightColumn]) : 1;
		const weight = Number.isFinite(rawWeight) && rawWeight > 0 ? rawWeight : 1;
		const rawGroup = groupColumn ? sanitizeNodeValue(linha[groupColumn]) : '';
		const group = rawGroup || 'default';

		if (!nodeMap.has(source)) {
			nodeMap.set(source, { id: source, group });
		} else if (groupColumn && nodeMap.get(source).group === 'default' && rawGroup) {
			nodeMap.get(source).group = rawGroup;
		}

		if (!nodeMap.has(target)) {
			nodeMap.set(target, { id: target, group });
		} else if (groupColumn && nodeMap.get(target).group === 'default' && rawGroup) {
			nodeMap.get(target).group = rawGroup;
		}

		links.push({ source, target, value: weight });
	});

	return {
		nodes: Array.from(nodeMap.values()),
		links,
	};
}

function stopPreviousSimulation(container) {
	const previous = container?.[SIMULATION_KEY];
	if (previous && typeof previous.stop === 'function') {
		previous.stop();
	}
	if (container) {
		container[SIMULATION_KEY] = null;
	}
}

export function renderNetworkGraph(container, dados, sourceColumn, targetColumn, opcoes = {}) {
	if (!container || !sourceColumn || !targetColumn) return fail();

	const weightColumn = opcoes.weightColumn || null;
	const groupColumn = opcoes.groupColumn || null;
	const nodeRadius = Number.isFinite(Number(opcoes.nodeRadius)) ? Number(opcoes.nodeRadius) : 5;
	const linkOpacity = Number.isFinite(Number(opcoes.linkOpacity)) ? Number(opcoes.linkOpacity) : 0.45;
	const chargeStrength = Number.isFinite(Number(opcoes.chargeStrength)) ? Number(opcoes.chargeStrength) : -80;
	const linkDistance = Number.isFinite(Number(opcoes.linkDistance)) ? Number(opcoes.linkDistance) : 46;
	const zoomScale = Number.isFinite(Number(opcoes.zoomScale))
		? Number(opcoes.zoomScale)
		: NETWORK_GRAPH.defaultZoomScale;
	const alphaDecay = Number.isFinite(Number(opcoes.alphaDecay))
		? Number(opcoes.alphaDecay)
		: NETWORK_GRAPH.defaultAlphaDecay;
	const showLegend = opcoes.showLegend !== false;
	const showNodeLabels = opcoes.showNodeLabels === true;
	const sourceNodeColor = /^#[0-9a-fA-F]{6}$/.test(String(opcoes.sourceNodeColor || '').trim())
		? String(opcoes.sourceNodeColor).trim()
		: '#e3743d';
	const targetNodeColor = /^#[0-9a-fA-F]{6}$/.test(String(opcoes.targetNodeColor || '').trim())
		? String(opcoes.targetNodeColor).trim()
		: '#6b94c9';
	const edgeColorMode = opcoes.edgeColorMode === 'uniform' ? 'uniform' : 'gradient';
	const customTitle = String(opcoes.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(opcoes.chartHeight))
		? Math.max(220, Math.min(720, Number(opcoes.chartHeight)))
		: 420;
	const locale = opcoes.locale || undefined;
	const labels = {
		node: opcoes.labels?.node || 'Node',
		linkWeight: opcoes.labels?.linkWeight || 'Weight',
		source: opcoes.labels?.source || 'Source',
		target: opcoes.labels?.target || 'Target',
	};

	const network = buildNetworkData(dados, sourceColumn, targetColumn, weightColumn, groupColumn);
	if (network.nodes.length === 0 || network.links.length === 0) {
		return fail('insufficient-data');
	}

	container.innerHTML = '';
	hideChartTooltip();
	stopPreviousSimulation(container);

	const largura = Math.max(container.clientWidth || CHART_DIMENSIONS.scatter.width, 320);
	const altura = chartHeight;

	const svg = select(container)
		.append('svg')
		.attr('width', largura)
		.attr('height', altura)
		.attr('viewBox', [-(largura / 2), -(altura / 2), largura, altura]);

	const viewport = svg.append('g');

	if (customTitle) {
		svg
			.append('text')
			.attr('x', 0)
			.attr('y', -(altura / 2) + 18)
			.attr('text-anchor', 'middle')
			.attr('font-size', 13)
			.attr('font-weight', 600)
			.attr('fill', '#3f3a33')
			.text(customTitle);
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

	let pinnedNode = null;
	const showNodeTooltip = (event, nodeData) => {
		const content = document.createElement('div');
		const line = document.createElement('div');
		const strong = document.createElement('strong');
		strong.textContent = `${labels.node}:`;
		line.appendChild(strong);
		line.append(` ${nodeData.id}`);
		content.appendChild(line);
		showChartTooltip(content, event.pageX, event.pageY);
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
			d._gradientId = `network-link-gradient-${index}-${Math.random().toString(36).slice(2, 8)}`;
		})
		.attr('stroke', d => {
			if (edgeColorMode === 'uniform') return '#7d7d7d';
			return `url(#${d._gradientId})`;
		})
		.attr('stroke-width', d => Math.max(1, Math.sqrt(Number(d.value) || 1)))
		.on('mouseenter', (event, linkData) => {
			const content = document.createElement('div');
			const makeLine = (label, value) => {
				const row = document.createElement('div');
				const strong = document.createElement('strong');
				strong.textContent = `${label}:`;
				row.appendChild(strong);
				row.append(` ${value}`);
				return row;
			};
			content.appendChild(makeLine(labels.source, String(linkData.source.id || linkData.source)));
			content.appendChild(makeLine(labels.target, String(linkData.target.id || linkData.target)));
			content.appendChild(makeLine(labels.linkWeight, formatNumber(Number(linkData.value) || 0, locale)));
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
			if (pinnedNode !== null) return;
			showNodeTooltip(event, nodeData);
		})
		.on('mousemove', event => {
			if (pinnedNode !== null) return;
			moveChartTooltip(event.pageX, event.pageY);
		})
		.on('mouseleave', () => {
			if (pinnedNode !== null) return;
			hideChartTooltip();
		})
		.on('click', (event, nodeData) => {
			event.stopPropagation();
			if (pinnedNode === nodeData.id) {
				pinnedNode = null;
				hideChartTooltip();
				return;
			}
			pinnedNode = nodeData.id;
			showNodeTooltip(event, nodeData);
		});

	svg.on('click', () => {
		pinnedNode = null;
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
		});

	svg.call(zoomBehavior);
	svg.call(
		zoomBehavior.transform,
		zoomIdentity.scale(Math.min(Math.max(zoomScale, NETWORK_GRAPH.minZoomScale), NETWORK_GRAPH.maxZoomScale))
	);

	if (showLegend) {
		const legend = svg
			.append('g')
			.attr('transform', `translate(${-(largura / 2) + 12},${-(altura / 2) + 12})`)
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
	});

	return {
		ok: true,
		nodesCount: nodes.length,
		linksCount: links.length,
	};
}
