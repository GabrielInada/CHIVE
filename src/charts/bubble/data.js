/**
 * Bubble-chart hierarchy helpers.
 *
 * Pure utilities that turn rows into bubble nodes, then group them into a
 * multi-level hierarchy ready for D3's `pack` layout. Used by
 * `renderers/svg.js` and covered by unit tests.
 */

import { normalizeColumnNameList } from '../../domain/datasets/columns.js';
import { categoryKey, describeCategory } from '../../domain/datasets/cellValues.js';
import { aggregateCategories } from '../shared/categoryAggregation.js';
import { BUBBLE_CHART } from '../../config/charts/definitions/bubble.js';

/**
 * Resolve the effective nesting-column list from a bubble options bag.
 * Normalizes the canonical `nestingColumns` (type-filter, de-dupe, and the shared
 * depth cap) and returns it when non-empty; otherwise falls back to the legacy
 * single `groupColumn`, routed through the same helper so an empty or non-string
 * group drops to `[]` rather than becoming a `['']` level. No allowlist here: the
 * renderer has no column metadata, so the cap is its independent defense.
 *
 * @param {Object} options
 * @returns {string[]}
 */
export function resolveNestingColumns(options) {
	const canonical = normalizeColumnNameList(options.nestingColumns, { max: BUBBLE_CHART.maxNestingDepth });
	if (canonical.length > 0) return canonical;
	return normalizeColumnNameList([options.groupColumn], { max: 1 });
}

/**
 * @typedef {{ key: string, label: string, token: string }} BubbleCategory
 * @typedef {BubbleCategory & { value: number, groupKey: string, groupLabel: string, nestingPath: BubbleCategory[] }} Bubble
 */

/**
 * Aggregate canonical rows into bubbles (one per category key). Each bubble
 * carries its measured value, top-level group, and the full nesting path
 * through the configured nesting columns, read from the first row counted
 * toward it. Missing cells form one missing bucket per column, apart from
 * text that reads "N/A".
 *
 * Fails like `aggregateCategories`. On success, bubbles are ordered by
 * value descending (key tiebreak, missing last) and capped at `topN`.
 *
 * @param {Object} args
 * @param {Array<Object<string, *>>} args.rows
 * @param {string} args.categoryColumn
 * @param {'count' | 'sum' | 'mean'} args.measureMode
 * @param {string | null} args.valueColumn
 * @param {string[]} args.nestingColumns
 * @param {number} args.topN - `0` or negative → keep all bubbles.
 * @param {string} [args.missingLabel] - Localized label of the missing bucket.
 * @returns {{ ok: false, reason?: 'no-value-column' | 'no-numeric' } | { ok: true, entries: Bubble[] }}
 */
export function aggregateBubbles({ rows, categoryColumn, measureMode, valueColumn, nestingColumns, topN, missingLabel }) {
	const aggregated = aggregateCategories(rows, categoryColumn, { measureMode, valueColumn, missingLabel });
	if (!aggregated.ok) return aggregated;

	const describe = key => ({ key, ...describeCategory(key, { missingLabel }) });
	const kept = topN > 0 ? aggregated.entries.slice(0, topN) : aggregated.entries;
	const entries = kept.map(({ firstRow, ...category }) => {
		const nestingPath = nestingColumns.map(column => describe(categoryKey(firstRow[column])));
		const group = nestingPath[0] || category;
		return { ...category, groupKey: group.key, groupLabel: group.label, nestingPath };
	});
	return { ok: true, entries };
}

/**
 * Convert flat bubbles into the nested tree shape D3's `hierarchy()`
 * expects. Inserts intermediate group nodes at each nesting level, keyed by
 * category key; leaves are appended as children of their innermost ancestor.
 *
 * @param {Array<{ nestingPath: BubbleCategory[] }>} bubbles
 * @param {string[]} nestingColumns
 * @returns {{ children: Array<{ groupKey: string, groupLabel: string, groupToken: string, depth: number, pathKey: string, children: Array<*> }> }}
 */
export function buildMultiLevelHierarchy(bubbles, nestingColumns) {
	const root = { children: new Map() };

	for (const bubble of bubbles) {
		let current = root;
		for (let depth = 0; depth < nestingColumns.length; depth++) {
			const segment = bubble.nestingPath[depth];
			if (!current.children.has(segment.key)) {
				current.children.set(segment.key, {
					groupKey: segment.key,
					groupLabel: segment.label,
					groupToken: segment.token,
					depth: depth + 1,
					pathKey: bubble.nestingPath.slice(0, depth + 1).map(part => part.key).join('→'),
					children: new Map(),
				});
			}
			current = current.children.get(segment.key);
		}
		if (!current.leaves) current.leaves = [];
		current.leaves.push(bubble);
	}

	/** @private */
	function convertNode(mapNode) {
		const { groupKey, groupLabel, groupToken, depth, pathKey } = mapNode;
		const intermediateChildren = Array.from(mapNode.children.values()).map(convertNode);
		return {
			groupKey,
			groupLabel,
			groupToken,
			depth,
			pathKey,
			children: mapNode.leaves ? [...intermediateChildren, ...mapNode.leaves] : intermediateChildren,
		};
	}

	const rootChildren = Array.from(root.children.values()).map(convertNode);
	return { children: rootChildren };
}

/**
 * Walk up the D3 hierarchy node's parent chain to find the top-level
 * group node (one level below the root). Used to color bubbles by their
 * outermost group: the key picks the color, the label is shown.
 *
 * @param {*} node - A D3 `hierarchy()` node below the root, with `.parent` and `.data`.
 * @returns {{ key: string, label: string }}
 */
export function getTopLevelGroup(node) {
	let current = node;
	while (current.parent && current.parent.parent) {
		current = current.parent;
	}
	const { groupKey, groupLabel } = current.data;
	return { key: groupKey, label: groupLabel };
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
 * O(depth), walks up via `.parent`.
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
