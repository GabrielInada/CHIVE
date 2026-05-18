import { compareStrings, normalizeCategoryValue } from '../../utils/chartFilters.js';

export function resolveNestingColumns(opcoes) {
	if (Array.isArray(opcoes.nestingColumns) && opcoes.nestingColumns.length > 0) {
		return [...new Set(opcoes.nestingColumns.filter(c => c && typeof c === 'string'))];
	}
	if (opcoes.groupColumn && typeof opcoes.groupColumn === 'string') {
		return [opcoes.groupColumn];
	}
	return [];
}

export function aggregateBubbles({ rows, categoryColumn, measureMode, valueColumn, nestingColumns, topN }) {
	if (measureMode !== 'count' && !valueColumn) {
		return { bubbles: [], reason: 'no-value-column' };
	}

	const hasValueColumn = measureMode === 'count'
		? true
		: rows.some(linha => Object.prototype.hasOwnProperty.call(linha, valueColumn));

	const aggregated = new Map();
	const nestingByCategory = new Map();

	if (measureMode === 'count') {
		rows.forEach(linha => {
			const category = normalizeCategoryValue(linha[categoryColumn]);
			aggregated.set(category, (aggregated.get(category) || 0) + 1);
			if (nestingColumns.length > 0 && !nestingByCategory.has(category)) {
				nestingByCategory.set(category, nestingColumns.map(col => normalizeCategoryValue(linha[col])));
			}
		});
	} else {
		if (!hasValueColumn) return { bubbles: [], reason: 'no-value-column' };
		const counter = new Map();
		rows.forEach(linha => {
			const category = normalizeCategoryValue(linha[categoryColumn]);
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
		return { bubbles: [], reason: 'no-numeric' };
	}

	let bubbles = Array.from(aggregated.entries()).map(([category, value]) => ({
		category,
		value,
		group: nestingColumns.length > 0 ? (nestingByCategory.get(category)?.[0] || '—') : category,
		nestingPath: nestingColumns.length > 0 ? (nestingByCategory.get(category) || nestingColumns.map(() => '—')) : [],
	}));

	bubbles.sort((a, b) => b.value - a.value || compareStrings(a.category, b.category));
	if (topN > 0) {
		bubbles = bubbles.slice(0, topN);
	}

	return { bubbles, reason: null };
}

export function buildMultiLevelHierarchy(bubbles, nestingColumns) {
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
		if (!current.leaves) current.leaves = [];
		current.leaves.push(bubble);
	}

	function convertNode(mapNode) {
		if (mapNode.leaves) {
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

	const rootChildren = Array.from(root.children.values()).map(convertNode);
	return { children: rootChildren };
}

export function getTopLevelGroup(node) {
	let current = node;
	while (current.parent && current.parent.parent) {
		current = current.parent;
	}
	return current.data.groupName || current.data.group || current.data.category || '—';
}

export function isIntermediate(node) {
	return node.depth > 0 && node.children && node.children.length > 0;
}

export function isDescendantOf(node, ancestor) {
	let current = node.parent;
	while (current) {
		if (current === ancestor) return true;
		current = current.parent;
	}
	return false;
}
