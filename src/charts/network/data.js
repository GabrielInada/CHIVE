/**
 * Network-graph data derivation.
 *
 * Derives the node set and link list from row-encoded edges. Nodes are the
 * union of the (sanitized, non-empty) source/target values and are deduplicated
 * by id; a node's group is taken from the first row that names it and upgraded
 * from the `default` placeholder if a later row supplies a real group. Links are
 * NOT deduplicated: every row with a valid source and target pushes one link.
 * Pure: no DOM, no d3. Used by `renderers/svg.js`.
 */

import { isNullish } from '../../utils/formatters.js';

/** @private */
function sanitizeNodeValue(value) {
	if (isNullish(value)) return '';
	return String(value).trim();
}

/**
 * Build the `{ nodes, links }` graph model from rows.
 *
 * @param {Array<Object<string, *>>} rows - Source rows (one row per edge).
 * @param {string} sourceColumn
 * @param {string} targetColumn
 * @param {string|null} weightColumn - Optional numeric edge-weight column; non-positive/non-finite -> 1.
 * @param {string|null} groupColumn - Optional categorical node-group column.
 * @returns {{ nodes: Array<{id: string, group: string}>, links: Array<{source: string, target: string, value: number}> }}
 */
export function buildNetworkData(rows, sourceColumn, targetColumn, weightColumn, groupColumn) {
	const nodeMap = new Map();
	const links = [];

	rows.forEach(row => {
		const source = sanitizeNodeValue(row[sourceColumn]);
		const target = sanitizeNodeValue(row[targetColumn]);
		if (!source || !target) return;

		const rawWeight = weightColumn ? Number(row[weightColumn]) : 1;
		const weight = Number.isFinite(rawWeight) && rawWeight > 0 ? rawWeight : 1;
		const rawGroup = groupColumn ? sanitizeNodeValue(row[groupColumn]) : '';
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
