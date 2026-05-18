import { describe, expect, it } from 'vitest';
import {
	resolveNestingColumns,
	aggregateBubbles,
	buildMultiLevelHierarchy,
	getTopLevelGroup,
	isIntermediate,
	isDescendantOf,
} from '../../../src/modules/visualizations/bubbleChartHierarchy.js';

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
});

describe('aggregateBubbles', () => {
	const rows = [
		{ cat: 'A', val: 10, parent: 'P1' },
		{ cat: 'A', val: 20, parent: 'P1' },
		{ cat: 'B', val: 5, parent: 'P2' },
		{ cat: 'B', val: 15, parent: 'P2' },
		{ cat: 'C', val: 30, parent: 'P1' },
	];

	it('count mode produces one bubble per category with row counts', () => {
		const result = aggregateBubbles({
			rows,
			categoryColumn: 'cat',
			measureMode: 'count',
			valueColumn: null,
			nestingColumns: [],
			topN: 0,
		});
		expect(result.reason).toBeNull();
		expect(result.bubbles.map(b => [b.category, b.value])).toEqual([
			['A', 2],
			['C', 1],
			['B', 2],
		].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)));
	});

	it('sum mode sums the value column per category', () => {
		const result = aggregateBubbles({
			rows,
			categoryColumn: 'cat',
			measureMode: 'sum',
			valueColumn: 'val',
			nestingColumns: [],
			topN: 0,
		});
		expect(result.reason).toBeNull();
		const byCat = Object.fromEntries(result.bubbles.map(b => [b.category, b.value]));
		expect(byCat).toEqual({ A: 30, B: 20, C: 30 });
	});

	it('mean mode averages the value column per category', () => {
		const result = aggregateBubbles({
			rows,
			categoryColumn: 'cat',
			measureMode: 'mean',
			valueColumn: 'val',
			nestingColumns: [],
			topN: 0,
		});
		expect(result.reason).toBeNull();
		const byCat = Object.fromEntries(result.bubbles.map(b => [b.category, b.value]));
		expect(byCat).toEqual({ A: 15, B: 10, C: 30 });
	});

	it('returns no-value-column when valueColumn is missing under sum/mean', () => {
		expect(aggregateBubbles({
			rows,
			categoryColumn: 'cat',
			measureMode: 'sum',
			valueColumn: null,
			nestingColumns: [],
			topN: 0,
		})).toEqual({ bubbles: [], reason: 'no-value-column' });
	});

	it('returns no-value-column when no row carries the configured valueColumn', () => {
		expect(aggregateBubbles({
			rows: [{ cat: 'A' }, { cat: 'B' }],
			categoryColumn: 'cat',
			measureMode: 'sum',
			valueColumn: 'val',
			nestingColumns: [],
			topN: 0,
		})).toEqual({ bubbles: [], reason: 'no-value-column' });
	});

	it('returns no-numeric when sum/mean produces zero aggregated values', () => {
		expect(aggregateBubbles({
			rows: [{ cat: 'A', val: 'nope' }, { cat: 'B', val: 'NaN' }],
			categoryColumn: 'cat',
			measureMode: 'sum',
			valueColumn: 'val',
			nestingColumns: [],
			topN: 0,
		})).toEqual({ bubbles: [], reason: 'no-numeric' });
	});

	it('populates nestingPath from the first row per category', () => {
		const result = aggregateBubbles({
			rows,
			categoryColumn: 'cat',
			measureMode: 'count',
			valueColumn: null,
			nestingColumns: ['parent'],
			topN: 0,
		});
		const byCat = Object.fromEntries(result.bubbles.map(b => [b.category, b.nestingPath]));
		expect(byCat.A).toEqual(['P1']);
		expect(byCat.B).toEqual(['P2']);
		expect(byCat.C).toEqual(['P1']);
	});

	it('topN truncates after sorting by value desc, then category asc', () => {
		const result = aggregateBubbles({
			rows,
			categoryColumn: 'cat',
			measureMode: 'sum',
			valueColumn: 'val',
			nestingColumns: [],
			topN: 2,
		});
		expect(result.bubbles.length).toBe(2);
		expect(result.bubbles[0].value).toBe(30);
		expect(result.bubbles[1].value).toBe(30);
		expect(result.bubbles.map(b => b.category)).toEqual(['A', 'C']);
	});
});

describe('buildMultiLevelHierarchy', () => {
	it('returns empty children when nestingColumns is empty', () => {
		const result = buildMultiLevelHierarchy(
			[{ category: 'A', value: 1, nestingPath: [] }],
			[],
		);
		expect(result).toEqual({ children: [] });
	});

	it('builds a single-level tree from one nesting column', () => {
		const bubbles = [
			{ category: 'A', value: 1, nestingPath: ['G1'] },
			{ category: 'B', value: 2, nestingPath: ['G1'] },
			{ category: 'C', value: 3, nestingPath: ['G2'] },
		];
		const result = buildMultiLevelHierarchy(bubbles, ['parent']);
		expect(result.children).toHaveLength(2);
		const g1 = result.children.find(c => c.groupName === 'G1');
		const g2 = result.children.find(c => c.groupName === 'G2');
		expect(g1.depth).toBe(1);
		expect(g1.pathKey).toBe('G1');
		expect(g1.children.map(c => c.category)).toEqual(['A', 'B']);
		expect(g2.children.map(c => c.category)).toEqual(['C']);
	});

	it('builds a two-level tree from two nesting columns', () => {
		const bubbles = [
			{ category: 'A', value: 1, nestingPath: ['G1', 'S1'] },
			{ category: 'B', value: 2, nestingPath: ['G1', 'S2'] },
			{ category: 'C', value: 3, nestingPath: ['G2', 'S1'] },
		];
		const result = buildMultiLevelHierarchy(bubbles, ['l1', 'l2']);
		expect(result.children).toHaveLength(2);
		const g1 = result.children.find(c => c.groupName === 'G1');
		expect(g1.depth).toBe(1);
		expect(g1.pathKey).toBe('G1');
		expect(g1.children).toHaveLength(2);
		const s1 = g1.children.find(c => c.groupName === 'S1');
		expect(s1.depth).toBe(2);
		expect(s1.pathKey).toBe('G1→S1');
		expect(s1.children.map(c => c.category)).toEqual(['A']);
	});

	it('builds a three-level tree from three nesting columns', () => {
		const bubbles = [
			{ category: 'A', value: 1, nestingPath: ['L1', 'L2', 'L3'] },
		];
		const result = buildMultiLevelHierarchy(bubbles, ['a', 'b', 'c']);
		const l1 = result.children[0];
		const l2 = l1.children[0];
		const l3 = l2.children[0];
		expect(l1.depth).toBe(1);
		expect(l2.depth).toBe(2);
		expect(l3.depth).toBe(3);
		expect(l3.pathKey).toBe('L1→L2→L3');
		expect(l3.children[0].category).toBe('A');
	});

	it('groups multiple bubbles that share the deepest path under one intermediate node', () => {
		const bubbles = [
			{ category: 'A', value: 1, nestingPath: ['G1', 'S1'] },
			{ category: 'B', value: 2, nestingPath: ['G1', 'S1'] },
		];
		const result = buildMultiLevelHierarchy(bubbles, ['l1', 'l2']);
		const s1 = result.children[0].children[0];
		expect(s1.children.map(c => c.category)).toEqual(['A', 'B']);
	});

	it('produces intermediate nodes with {groupName, depth, pathKey, children} shape (D3-compatible)', () => {
		const bubbles = [{ category: 'A', value: 1, nestingPath: ['G1'] }];
		const result = buildMultiLevelHierarchy(bubbles, ['parent']);
		const node = result.children[0];
		expect(Object.keys(node).sort()).toEqual(['children', 'depth', 'groupName', 'pathKey']);
	});
});

describe('getTopLevelGroup', () => {
	const root = { parent: null, depth: 0, data: { groupName: 'root' } };
	const level1 = { parent: root, depth: 1, data: { groupName: 'L1' } };
	const level2 = { parent: level1, depth: 2, data: { groupName: 'L2' } };
	const leaf = { parent: level2, depth: 3, data: { category: 'cat1' } };

	it('walks up to the first child of root for a deep leaf', () => {
		expect(getTopLevelGroup(leaf)).toBe('L1');
	});

	it('returns the depth-1 node directly when passed', () => {
		expect(getTopLevelGroup(level1)).toBe('L1');
	});

	it('falls back through groupName → group → category → em-dash', () => {
		const orphan = { parent: null, depth: 0, data: {} };
		expect(getTopLevelGroup(orphan)).toBe('—');
		const withGroup = { parent: null, depth: 0, data: { group: 'g' } };
		expect(getTopLevelGroup(withGroup)).toBe('g');
		const withCategory = { parent: null, depth: 0, data: { category: 'c' } };
		expect(getTopLevelGroup(withCategory)).toBe('c');
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
