/**
 * Bubble-chart hierarchy helpers.
 *
 * Pure utilities that turn rows into bubble nodes, then group them into a
 * multi-level hierarchy ready for D3's `pack` layout. Used by
 * `bubbleChart.js` and covered by unit tests.
 */

import { compareStrings, normalizeCategoryValue } from '../../utils/chartFilters.js';

/**
 * Resolve the effective nesting-column list from a bubble options bag.
 * Prefers the canonical `nestingColumns` array; falls back to the legacy
 * single `groupColumn`. De-duplicates while preserving order.
 *
 * @param {Object} opcoes
 * @returns {string[]}
 */
export function resolveNestingColumns(opcoes) {
	if (Array.isArray(opcoes.nestingColumns) && opcoes.nestingColumns.length > 0) {
		return [...new Set(opcoes.nestingColumns.filter(c => c && typeof c === 'string'))];
	}
	if (opcoes.groupColumn && typeof opcoes.groupColumn === 'string') {
		return [opcoes.groupColumn];
	}
	return [];
}

/**
 * Aggregate rows into bubbles (one per distinct category value). Each
 * bubble carries its measured value, top-level group, and the full
 * nesting-path through the configured nesting columns.
 *
 * Failure modes: sum/mean without `valueColumn` → `'no-value-column'`;
 * sum/mean over rows with no parseable values → `'no-numeric'`. On
 * success, sorts bubbles descending by value (alphabetical tiebreak) and
 * applies the `topN` cap.
 *
 * @param {Object} args
 * @param {Array<Object<string, *>>} args.rows
 * @param {string} args.categoryColumn
 * @param {'count' | 'sum' | 'mean'} args.measureMode
 * @param {string | null} args.valueColumn
 * @param {string[]} args.nestingColumns
 * @param {number} args.topN - `0` or negative → keep all bubbles.
 * @returns {{ bubbles: Array<{ category: string, value: number, group: string, nestingPath: string[] }>, reason: 'no-value-column' | 'no-numeric' | null }}
 */
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

/**
 * Convert flat bubbles into the nested tree shape D3's `hierarchy()`
 * expects. Inserts intermediate group nodes at each nesting level; leaves
 * are appended as children of their innermost ancestor.
 *
 * @param {Array<{ nestingPath: string[] }>} bubbles
 * @param {string[]} nestingColumns
 * @returns {{ children: Array<{ groupName: string, depth: number, pathKey: string, children: Array<*> }> }}
 */
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

	/** @private */
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

/**
 * Walk up the D3 hierarchy node's parent chain to find the top-level
 * group node (one level below the root). Used to color bubbles by their
 * outermost group.
 *
 * @param {*} node - A D3 `hierarchy()` node with `.parent` and `.data`.
 * @returns {string}
 */
export function getTopLevelGroup(node) {
	let current = node;
	while (current.parent && current.parent.parent) {
		current = current.parent;
	}
	return current.data.groupName || current.data.group || current.data.category || '—';
}

/**
 * True when `node` is an intermediate group (has children, not at root).
 *
 * @param {*} node - A D3 `hierarchy()` node.
 * @returns {boolean}
 */
export function isIntermediate(node) {
	return node.depth > 0 && node.children && node.children.length > 0;
}

/**
 * True when `node` lives somewhere beneath `ancestor` in the hierarchy.
 * O(depth) — walks up via `.parent`.
 *
 * @param {*} node
 * @param {*} ancestor
 * @returns {boolean}
 */
export function isDescendantOf(node, ancestor) {
	let current = node.parent;
	while (current) {
		if (current === ancestor) return true;
		current = current.parent;
	}
	return false;
}
