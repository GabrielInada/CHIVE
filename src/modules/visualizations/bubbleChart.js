import { hierarchy, pack, scaleOrdinal, select } from 'd3';
import { hideChartTooltip, moveChartTooltip, showChartTooltip } from './tooltip.js';
import { BUBBLE_CHART, CHART_COLOR_PALETTES, CHART_DIMENSIONS } from '../../config/charts.js';
import { formatNumber } from '../../utils/formatters.js';
import { ok, fail } from '../../utils/result.js';

function normalizeCategoryValue(value) {
	return value === null || value === undefined || value === '' ? '—' : String(value);
}

function getBubblePalette(colorScheme) {
	return CHART_COLOR_PALETTES[colorScheme] || CHART_COLOR_PALETTES.Tableau10;
}

/**
 * Resolve nestingColumns from options, with backward-compatible groupColumn fallback.
 */
function resolveNestingColumns(opcoes) {
	if (Array.isArray(opcoes.nestingColumns) && opcoes.nestingColumns.length > 0) {
		// Deduplicate preserving order
		return [...new Set(opcoes.nestingColumns.filter(c => c && typeof c === 'string'))];
	}
	if (opcoes.groupColumn && typeof opcoes.groupColumn === 'string') {
		return [opcoes.groupColumn];
	}
	return [];
}

/**
 * Build a multi-level hierarchy tree from aggregated leaf records.
 * Each leaf gets a path derived from nestingColumns values.
 */
function buildMultiLevelHierarchy(bubbles, nestingColumns) {
	const root = { children: new Map() };

	for (const bubble of bubbles) {
		let current = root;
		for (let depth = 0; depth < nestingColumns.length; depth++) {
			const segmentValue = bubble.nestingPath[depth];
			if (!current.children.has(segmentValue)) {
				current.children.set(segmentValue, {
					groupName: segmentValue,
					depth: depth + 1,
					pathKey: bubble.nestingPath.slice(0, depth + 1).join('→'),
					children: new Map(),
				});
			}
			current = current.children.get(segmentValue);
		}
		// At the deepest intermediate node, store leaf
		if (!current.leaves) current.leaves = [];
		current.leaves.push(bubble);
	}

	// Convert map-based tree to plain hierarchy object
	function convertNode(mapNode) {
		if (mapNode.leaves) {
			// Deepest intermediate: children are leaf bubbles
			const intermediateChildren = Array.from(mapNode.children.values()).map(convertNode);
			return {
				groupName: mapNode.groupName,
				depth: mapNode.depth,
				pathKey: mapNode.pathKey,
				children: [...intermediateChildren, ...mapNode.leaves],
			};
		}
		return {
			groupName: mapNode.groupName,
			depth: mapNode.depth,
			pathKey: mapNode.pathKey,
			children: Array.from(mapNode.children.values()).map(convertNode),
		};
	}

	// Root level
	const rootChildren = Array.from(root.children.values()).map(convertNode);
	return { children: rootChildren };
}

/**
 * Find the top-level ancestor group name for color assignment.
 */
function getTopLevelGroup(node) {
	// Walk up to depth 1 (first nesting level child of root)
	let current = node;
	while (current.parent && current.parent.parent) {
		current = current.parent;
	}
	return current.data.groupName || current.data.group || current.data.category || '—';
}

/**
 * Check if a node is an intermediate (non-leaf, non-root) node.
 */
function isIntermediate(node) {
	return node.depth > 0 && node.children && node.children.length > 0;
}

/**
 * Check if a d3 hierarchy node is a descendant of another node.
 */
function isDescendantOf(node, ancestor) {
	let current = node.parent;
	while (current) {
		if (current === ancestor) return true;
		current = current.parent;
	}
	return false;
}

export function renderBubbleChart(container, dados, colunaCategoria, opcoes = {}) {
	if (!container || !colunaCategoria) return fail();

	const measureMode = BUBBLE_CHART.measureModes.includes(opcoes.measureMode)
		? opcoes.measureMode
		: BUBBLE_CHART.defaultMeasureMode;
	const valueColumn = opcoes.valueColumn || null;
	const topN = Number.isFinite(Number(opcoes.topN)) ? Number(opcoes.topN) : BUBBLE_CHART.defaultTopN;
	const padding = Number.isFinite(Number(opcoes.padding))
		? Number(opcoes.padding)
		: BUBBLE_CHART.defaultPadding;
	const labelMode = BUBBLE_CHART.labelModes.includes(opcoes.labelMode)
		? opcoes.labelMode
		: BUBBLE_CHART.defaultLabelMode;
	const autoLabelMinRadius = Number.isFinite(Number(opcoes.autoLabelMinRadius))
		? Number(opcoes.autoLabelMinRadius)
		: BUBBLE_CHART.autoLabelMinRadius;
	const parentLabelMinRadius = BUBBLE_CHART.parentLabelMinRadius;
	const nestingMode = BUBBLE_CHART.nestingModes.includes(opcoes.nestingMode)
		? opcoes.nestingMode
		: BUBBLE_CHART.defaultNestingMode;
	const nestingColumns = resolveNestingColumns(opcoes);
	const locale = opcoes.locale || undefined;
	const customTitle = String(opcoes.customTitle || '').trim().slice(0, 80);
	const chartHeight = Number.isFinite(Number(opcoes.chartHeight))
		? Math.max(400, Math.min(900, Number(opcoes.chartHeight)))
		: CHART_DIMENSIONS.bubble.height;
	const colorScheme = String(opcoes.colorScheme || '').trim() || 'Tableau10';
	const labels = {
		categoria: opcoes.labels?.categoria || 'Category',
		contagem: opcoes.labels?.contagem || 'Count',
		soma: opcoes.labels?.soma || 'Sum',
		media: opcoes.labels?.media || 'Mean',
		grupo: opcoes.labels?.grupo || 'Group',
		filhos: opcoes.labels?.filhos || 'Children',
		nivel: opcoes.labels?.nivel || 'Level',
	};

	if (nestingMode === 'grouped' && nestingColumns.length === 0) {
		// Backward compat: also check legacy groupColumn
		if (!opcoes.groupColumn) {
			return fail('no-nesting-columns');
		}
	}

	const hasValueColumn = measureMode === 'count'
		? true
		: dados.some(linha => Object.prototype.hasOwnProperty.call(linha, valueColumn));

	if (measureMode !== 'count' && !valueColumn) {
		return fail('no-value-column');
	}

	// Aggregate by category
	const aggregated = new Map();
	const nestingByCategory = new Map();

	if (measureMode === 'count') {
		dados.forEach(linha => {
			const category = normalizeCategoryValue(linha[colunaCategoria]);
			aggregated.set(category, (aggregated.get(category) || 0) + 1);
			if (nestingColumns.length > 0 && !nestingByCategory.has(category)) {
				nestingByCategory.set(category, nestingColumns.map(col => normalizeCategoryValue(linha[col])));
			}
		});
	} else {
		if (!hasValueColumn) return fail('no-value-column');
		const counter = new Map();
		dados.forEach(linha => {
			const category = normalizeCategoryValue(linha[colunaCategoria]);
			const rawValue = Number(linha[valueColumn]);
			if (!Number.isFinite(rawValue)) return;
			aggregated.set(category, (aggregated.get(category) || 0) + rawValue);
			counter.set(category, (counter.get(category) || 0) + 1);
			if (nestingColumns.length > 0 && !nestingByCategory.has(category)) {
				nestingByCategory.set(category, nestingColumns.map(col => normalizeCategoryValue(linha[col])));
			}
		});

		if (measureMode === 'mean') {
			for (const [category, sum] of aggregated.entries()) {
				aggregated.set(category, sum / (counter.get(category) || 1));
			}
		}
	}

	if ((measureMode === 'sum' || measureMode === 'mean') && aggregated.size === 0) {
		return fail('no-numeric');
	}

	let bubbles = Array.from(aggregated.entries()).map(([category, value]) => ({
		category,
		value,
		group: nestingColumns.length > 0 ? (nestingByCategory.get(category)?.[0] || '—') : category,
		nestingPath: nestingColumns.length > 0 ? (nestingByCategory.get(category) || nestingColumns.map(() => '—')) : [],
	}));

	bubbles.sort((a, b) => b.value - a.value || String(a.category).localeCompare(String(b.category)));
	if (topN > 0) {
		bubbles = bubbles.slice(0, topN);
	}

	if (bubbles.length === 0) {
		return fail();
	}

	container.innerHTML = '';
	hideChartTooltip();

	const largura = Math.max(container.clientWidth || CHART_DIMENSIONS.bubble.width, 320);
	const altura = chartHeight;
	const margem = CHART_DIMENSIONS.bubble.margins;
	const titleOffset = customTitle ? 20 : 0;
	const larguraInterna = largura - margem.left - margem.right;
	const alturaInterna = altura - margem.top - margem.bottom - titleOffset;

	const svg = select(container)
		.append('svg')
		.attr('width', largura)
		.attr('height', altura)
		.attr('viewBox', `0 0 ${largura} ${altura}`);

	if (customTitle) {
		svg
			.append('text')
			.attr('x', largura / 2)
			.attr('y', 16)
			.attr('text-anchor', 'middle')
			.attr('font-size', 13)
			.attr('font-weight', 600)
			.attr('fill', '#3f3a33')
			.text(customTitle);
	}

	const viewport = svg
		.append('g')
		.attr('transform', `translate(${margem.left},${margem.top + titleOffset})`);

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
		.size([larguraInterna, alturaInterna])
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
		colorDomain = root.children.map(c => c.data.groupName || '—');
	} else {
		colorDomain = Array.from(new Set(leaves.map(item => item.data.group)));
	}
	const colorScale = scaleOrdinal(getBubblePalette(colorScheme)).domain(colorDomain);

	let pinnedNode = null;
	const zoomStack = [];
	const zoomDuration = Number.isFinite(Number(opcoes.zoomTransitionDuration))
		? Number(opcoes.zoomTransitionDuration)
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

		const scale = Math.min(larguraInterna, alturaInterna) / (2 * targetNode.r * zoomPadding);
		const tx = larguraInterna / 2 - targetNode.x * scale;
		const ty = alturaInterna / 2 - targetNode.y * scale;
		const transform = `translate(${margem.left + tx},${margem.top + titleOffset + ty}) scale(${scale})`;

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

		const transform = `translate(${margem.left},${margem.top + titleOffset})`;

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
		? labels.media
		: measureMode === 'sum'
			? labels.soma
			: labels.contagem;

	const createLeafTooltip = item => {
		const wrapper = document.createElement('div');

		const makeLine = (label, value) => {
			const row = document.createElement('div');
			const strong = document.createElement('strong');
			strong.textContent = `${label}:`;
			row.appendChild(strong);
			row.append(` ${value}`);
			return row;
		};

		wrapper.appendChild(makeLine(labels.categoria, item.data.category));
		wrapper.appendChild(makeLine(measureLabel, formatNumber(item.data.value, locale)));
		if (isGrouped) {
			wrapper.appendChild(makeLine(labels.grupo, getTopLevelGroup(item)));
		}
		return wrapper;
	};

	const createParentTooltip = item => {
		const wrapper = document.createElement('div');
		const makeLine = (label, value) => {
			const row = document.createElement('div');
			const strong = document.createElement('strong');
			strong.textContent = `${label}:`;
			row.appendChild(strong);
			row.append(` ${value}`);
			return row;
		};

		wrapper.appendChild(makeLine(labels.grupo, item.data.groupName));
		wrapper.appendChild(makeLine(measureLabel, formatNumber(item.value, locale)));
		wrapper.appendChild(makeLine(labels.filhos, item.children.length));
		wrapper.appendChild(makeLine(labels.nivel, item.depth));
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
				showChartTooltip(createParentTooltip(item), event.pageX, event.pageY);
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
			`${labels.categoria}: ${d.data.category}`,
			`${measureLabel}: ${formatNumber(d.data.value, locale)}`,
		];
		if (isGrouped) {
			lines.push(`${labels.grupo}: ${getTopLevelGroup(d)}`);
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
			showLeafTooltip(event, item);
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
