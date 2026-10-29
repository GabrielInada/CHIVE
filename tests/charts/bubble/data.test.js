import { describe, expect, it } from 'vitest';
import {
	resolveNestingColumns,
	aggregateBubbles,
	buildMultiLevelHierarchy,
	getTopLevelGroup,
	isIntermediate,
	isDescendantOf,
} from '../../../src/charts/bubble/data.js';
import { BUBBLE_CHART } from '../../../src/config/charts/definitions/bubble.js';
import { MISSING_KEY, describeCategory } from '../../../src/domain/datasets/cellValues.js';
import { applyChartFilterRows } from '../../../src/domain/filters/chartFilter.js';

const segment = key => ({ key, ...describeCategory(key) });
const leaf = (key, value, path) => ({ key, value, nestingPath: path.map(segment) });

describe('resolveNestingColumns', () => {
	it('returns deduplicated string array from opcoes.nestingColumns', () => {
		expect(resolveNestingColumns({ nestingColumns: ['a', 'b', 'a', 'c'] })).toEqual(['a', 'b', 'c']);
	});

	it('falls back to legacy groupColumn as a single-level array', () => {
		expect(resolveNestingColumns({ groupColumn: 'region' })).toEqual(['region']);
	});

	it('returns empty array when neither nestingColumns nor groupColumn is set', () => {
		expect(resolveNestingColumns({})).toEqual([]);
	});

	it('filters out non-string and empty entries from nestingColumns', () => {
		expect(resolveNestingColumns({ nestingColumns: ['a', '', null, 0, 'b'] })).toEqual(['a', 'b']);
	});

	it('prefers nestingColumns over groupColumn when both are set', () => {
		expect(resolveNestingColumns({ nestingColumns: ['a'], groupColumn: 'b' })).toEqual(['a']);
	});

	it('caps an over-deep nestingColumns array at the shared maximum', () => {
		const deep = Array.from({ length: BUBBLE_CHART.maxNestingDepth + 4 }, (_, i) => `col${i}`);
		const resolved = resolveNestingColumns({ nestingColumns: deep });
		expect(resolved).toHaveLength(BUBBLE_CHART.maxNestingDepth);
		expect(resolved).toEqual(deep.slice(0, BUBBLE_CHART.maxNestingDepth));
	});

	it('falls back to a valid groupColumn when the canonical list normalizes to []', () => {
		expect(resolveNestingColumns({ nestingColumns: [null, ''], groupColumn: 'region' })).toEqual(['region']);
	});

	it('rejects an empty-string groupColumn rather than yielding [""]', () => {
		expect(resolveNestingColumns({ groupColumn: '' })).toEqual([]);
	});
});

describe('aggregateBubbles', () => {
	const rows = [
		{ cat: 'A', val: 10, parent: 'P1' },
		{ cat: 'A', val: 20, parent: 'P1' },
		{ cat: 'B', val: 5, parent: 'P2' },
		{ cat: 'B', val: 15, parent: 'P2' },
		{ cat: 'C', val: 30, parent: 'P1' },
	];
	const base = { rows, categoryColumn: 'cat', measureMode: 'count', valueColumn: null, nestingColumns: [], topN: 0 };

	it('measures bubbles through the shared category aggregation', () => {
		const result = aggregateBubbles({ ...base, measureMode: 'mean', valueColumn: 'val' });
		expect(result.ok).toBe(true);
		expect(result.entries.map(b => [b.key, b.value])).toEqual([['C', 30], ['A', 15], ['B', 10]]);
	});

	it('passes the shared failures through', () => {
		expect(aggregateBubbles({ ...base, measureMode: 'sum' })).toEqual({ ok: false, reason: 'no-value-column' });
		expect(aggregateBubbles({ ...base, rows: [{ cat: 'A', val: null }], measureMode: 'sum', valueColumn: 'val' }))
			.toEqual({ ok: false, reason: 'no-numeric' });
		expect(aggregateBubbles({ ...base, rows: [] })).toEqual({ ok: false });
	});

	it('populates nestingPath from the first row per category', () => {
		const result = aggregateBubbles({ ...base, nestingColumns: ['parent'] });
		const byCat = Object.fromEntries(result.entries.map(b => [b.key, b.nestingPath.map(part => part.key)]));
		expect(byCat).toEqual({ A: ['P1'], B: ['P2'], C: ['P1'] });
	});

	it('reads the nesting path from the first row with a number in sum mode', () => {
		const result = aggregateBubbles({
			...base,
			rows: [{ cat: 'A', val: null, parent: 'P1' }, { cat: 'A', val: 4, parent: 'P2' }],
			measureMode: 'sum',
			valueColumn: 'val',
			nestingColumns: ['parent'],
		});
		expect(result.entries.map(b => [b.key, b.value, b.groupKey])).toEqual([['A', 4, 'P2']]);
	});

	it('groups a flat bubble under its own category, missing bucket included', () => {
		const result = aggregateBubbles({ ...base, rows: [{ cat: 'A' }, { cat: null }], missingLabel: '(sem valor)' });
		expect(result.entries.map(b => [b.key, b.groupKey, b.groupLabel, b.nestingPath]))
			.toEqual([['A', 'A', 'A', []], [MISSING_KEY, MISSING_KEY, '(sem valor)', []]]);
	});

	it('topN truncates after sorting by value desc, then category asc', () => {
		const result = aggregateBubbles({ ...base, measureMode: 'sum', valueColumn: 'val', topN: 2 });
		expect(result.entries.map(b => [b.key, b.value])).toEqual([['A', 30], ['C', 30]]);
	});

	it('keys a missing nesting segment so its group token hides the missing rows', () => {
		const rows = [{ cat: 'A', g: null }, { cat: 'B', g: 'N/A' }, { cat: 'C', g: null }];
		const { entries } = aggregateBubbles({ ...base, rows, nestingColumns: ['g'], missingLabel: '(missing)' });
		const tree = buildMultiLevelHierarchy(entries, ['g']);
		const missingGroup = tree.children.find(node => node.groupKey === MISSING_KEY);
		expect(missingGroup.groupLabel).toBe('(missing)');
		expect(missingGroup.children.map(child => child.key)).toEqual(['A', 'C']);
		expect(applyChartFilterRows(rows, { column: 'g', exclude: [missingGroup.groupToken] })).toEqual([{ cat: 'B', g: 'N/A' }]);
	});
});

describe('buildMultiLevelHierarchy', () => {
	it('returns empty children when nestingColumns is empty', () => {
		const result = buildMultiLevelHierarchy(
			[leaf('A', 1, [])],
			[],
		);
		expect(result).toEqual({ children: [] });
	});

	it('builds a single-level tree from one nesting column', () => {
		const bubbles = [
			leaf('A', 1, ['G1']),
			leaf('B', 2, ['G1']),
			leaf('C', 3, ['G2']),
		];
		const result = buildMultiLevelHierarchy(bubbles, ['parent']);
		expect(result.children).toHaveLength(2);
		const g1 = result.children.find(c => c.groupKey === 'G1');
		const g2 = result.children.find(c => c.groupKey === 'G2');
		expect(g1.depth).toBe(1);
		expect(g1.pathKey).toBe('G1');
		expect(g1.children.map(c => c.key)).toEqual(['A', 'B']);
		expect(g2.children.map(c => c.key)).toEqual(['C']);
	});

	it('builds a two-level tree from two nesting columns', () => {
		const bubbles = [
			leaf('A', 1, ['G1', 'S1']),
			leaf('B', 2, ['G1', 'S2']),
			leaf('C', 3, ['G2', 'S1']),
		];
		const result = buildMultiLevelHierarchy(bubbles, ['l1', 'l2']);
		expect(result.children).toHaveLength(2);
		const g1 = result.children.find(c => c.groupKey === 'G1');
		expect(g1.depth).toBe(1);
		expect(g1.pathKey).toBe('G1');
		expect(g1.children).toHaveLength(2);
		const s1 = g1.children.find(c => c.groupKey === 'S1');
		expect(s1.depth).toBe(2);
		expect(s1.pathKey).toBe('G1→S1');
		expect(s1.children.map(c => c.key)).toEqual(['A']);
	});

	it('builds a three-level tree from three nesting columns', () => {
		const bubbles = [
			leaf('A', 1, ['L1', 'L2', 'L3']),
		];
		const result = buildMultiLevelHierarchy(bubbles, ['a', 'b', 'c']);
		const l1 = result.children[0];
		const l2 = l1.children[0];
		const l3 = l2.children[0];
		expect(l1.depth).toBe(1);
		expect(l2.depth).toBe(2);
		expect(l3.depth).toBe(3);
		expect(l3.pathKey).toBe('L1→L2→L3');
		expect(l3.children[0].key).toBe('A');
	});

	it('groups multiple bubbles that share the deepest path under one intermediate node', () => {
		const bubbles = [
			leaf('A', 1, ['G1', 'S1']),
			leaf('B', 2, ['G1', 'S1']),
		];
		const result = buildMultiLevelHierarchy(bubbles, ['l1', 'l2']);
		const s1 = result.children[0].children[0];
		expect(s1.children.map(c => c.key)).toEqual(['A', 'B']);
	});

	it('produces intermediate nodes with {groupKey, groupLabel, groupToken, depth, pathKey, children} shape (D3-compatible)', () => {
		const bubbles = [leaf('A', 1, ['G1'])];
		const result = buildMultiLevelHierarchy(bubbles, ['parent']);
		const node = result.children[0];
		expect(Object.keys(node).sort()).toEqual(['children', 'depth', 'groupKey', 'groupLabel', 'groupToken', 'pathKey']);
	});
});

describe('getTopLevelGroup', () => {
	const root = { parent: null, depth: 0, data: {} };
	const level1 = { parent: root, depth: 1, data: { groupKey: 'L1', groupLabel: 'L1' } };
	const level2 = { parent: level1, depth: 2, data: { groupKey: 'L2', groupLabel: 'L2' } };
	const deepLeaf = { parent: level2, depth: 3, data: { key: 'cat1', label: 'cat1' } };

	it('walks up to the first child of root for a deep leaf', () => {
		expect(getTopLevelGroup(deepLeaf)).toEqual({ key: 'L1', label: 'L1' });
	});

	it('returns the depth-1 node directly when passed', () => {
		expect(getTopLevelGroup(level1)).toEqual({ key: 'L1', label: 'L1' });
	});

	it('reads a flat bubble group', () => {
		const flat = { parent: root, depth: 1, data: { key: 'c', groupKey: 'c', groupLabel: 'c' } };
		expect(getTopLevelGroup(flat)).toEqual({ key: 'c', label: 'c' });
	});
});

describe('isIntermediate', () => {
	it('returns false for root (depth 0)', () => {
		expect(isIntermediate({ depth: 0, children: [{}, {}] })).toBe(false);
	});

	it('returns true for a depth>0 node with children', () => {
		expect(isIntermediate({ depth: 1, children: [{}] })).toBe(true);
	});

	it('returns a falsy value for a depth>0 node with no children (leaf)', () => {
		expect(isIntermediate({ depth: 2, children: undefined })).toBeFalsy();
		expect(isIntermediate({ depth: 2, children: [] })).toBe(false);
	});
});

describe('isDescendantOf', () => {
	const root = { parent: null };
	const level1 = { parent: root };
	const level2 = { parent: level1 };
	const leaf = { parent: level2 };

	it('returns true when ancestor is on the parent chain', () => {
		expect(isDescendantOf(leaf, level2)).toBe(true);
		expect(isDescendantOf(leaf, level1)).toBe(true);
		expect(isDescendantOf(leaf, root)).toBe(true);
	});

	it('returns false when the node and ancestor are the same', () => {
		expect(isDescendantOf(leaf, leaf)).toBe(false);
	});

	it('returns false for a node with no parent', () => {
		expect(isDescendantOf(root, level1)).toBe(false);
	});

	it('returns false for an unrelated node', () => {
		const sibling = { parent: root };
		expect(isDescendantOf(sibling, level1)).toBe(false);
	});
});
