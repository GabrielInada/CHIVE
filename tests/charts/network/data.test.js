import { describe, expect, it } from 'vitest';
import { buildNetworkData } from '../../../src/charts/network/data.js';

describe('buildNetworkData', () => {
	it('derives a deduplicated node set from the union of source/target', () => {
		const rows = [
			{ s: 'A', t: 'B' },
			{ s: 'A', t: 'C' },
			{ s: 'B', t: 'C' },
		];
		const { nodes } = buildNetworkData(rows, 's', 't', null, null);
		expect(nodes.map(n => n.id).sort()).toEqual(['A', 'B', 'C']);
	});

	it('does NOT deduplicate links: one link per valid row', () => {
		const rows = [
			{ s: 'A', t: 'B' },
			{ s: 'A', t: 'B' },
			{ s: 'A', t: 'B' },
		];
		const { nodes, links } = buildNetworkData(rows, 's', 't', null, null);
		expect(nodes).toHaveLength(2);
		expect(links).toHaveLength(3);
		expect(links.every(l => l.source === 'A' && l.target === 'B' && l.value === 1)).toBe(true);
	});

	it('skips rows whose source or target is empty/whitespace, and trims node ids', () => {
		const rows = [
			{ s: 'A', t: '' },
			{ s: '', t: 'B' },
			{ s: '  C  ', t: 'D' },
		];
		const { nodes, links } = buildNetworkData(rows, 's', 't', null, null);
		expect(nodes.map(n => n.id).sort()).toEqual(['C', 'D']);
		expect(links).toEqual([{ source: 'C', target: 'D', value: 1 }]);
	});

	it('reads weights from the weight column and floors non-positive/non-finite to 1', () => {
		const rows = [
			{ s: 'A', t: 'B', w: 5 },
			{ s: 'A', t: 'C', w: 0 },
			{ s: 'B', t: 'C', w: -3 },
			{ s: 'C', t: 'D', w: 'x' },
		];
		const { links } = buildNetworkData(rows, 's', 't', 'w', null);
		expect(links.map(l => l.value)).toEqual([5, 1, 1, 1]);
	});

	it('groups nodes as default without a group column', () => {
		const { nodes } = buildNetworkData([{ s: 'A', t: 'B' }], 's', 't', null, null);
		expect(nodes.every(n => n.group === 'default')).toBe(true);
	});

	it('assigns groups from the group column and upgrades a default group when a later row supplies one', () => {
		const rows = [
			{ s: 'A', t: 'B', g: '' },   // A,B start as default
			{ s: 'A', t: 'C', g: 'X' },  // A upgrades to X; C is X
		];
		const { nodes } = buildNetworkData(rows, 's', 't', null, 'g');
		const byId = Object.fromEntries(nodes.map(n => [n.id, n.group]));
		expect(byId.A).toBe('X');
		expect(byId.B).toBe('default');
		expect(byId.C).toBe('X');
	});
});
