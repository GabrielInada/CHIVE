// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { calculateCategoricalStatistics } from '../../src/services/dataService.js';

describe('calculateCategoricalStatistics', () => {
	it('returns no entries when no categorical columns are visible', () => {
		const stats = calculateCategoricalStatistics(
			[{ x: 1 }, { x: 2 }],
			[{ nome: 'x', tipo: 'numero' }],
		);
		expect(stats).toEqual([]);
	});

	it('computes mode, missing and unique for a basic categorical column', () => {
		const rows = [
			{ city: 'Belém' },
			{ city: 'Belém' },
			{ city: 'Manaus' },
			{ city: 'Recife' },
			{ city: null },
			{ city: '' },
		];
		const [stat] = calculateCategoricalStatistics(rows, [{ nome: 'city', tipo: 'texto' }]);
		expect(stat.nome).toBe('city');
		expect(stat.n).toBe(4);
		expect(stat.missing).toBe(2);
		expect(stat.missingPct).toBeCloseTo(2 / 6, 4);
		expect(stat.unique).toBe(3);
		expect(stat.uniquenessRate).toBeCloseTo(3 / 4, 4);
		expect(stat.mode).toBe('Belém');
		expect(stat.modeCount).toBe(2);
		expect(stat.modePct).toBeCloseTo(0.5, 4);
		expect(stat.top5Pct).toBeCloseTo(1, 4);
		expect(stat.empty).toBe(false);
	});

	it('handles a column where every value is missing', () => {
		const [stat] = calculateCategoricalStatistics(
			[{ a: null }, { a: undefined }, { a: '   ' }],
			[{ nome: 'a', tipo: 'texto' }],
		);
		expect(stat.empty).toBe(true);
		expect(stat.n).toBe(0);
		expect(stat.missing).toBe(3);
		expect(stat.missingPct).toBeCloseTo(1, 4);
		expect(stat.unique).toBe(0);
		expect(stat.mode).toBeNull();
	});

	it('top5Pct caps at the sum of the top five values', () => {
		const rows = [
			...Array(5).fill({ k: 'a' }),
			...Array(4).fill({ k: 'b' }),
			...Array(3).fill({ k: 'c' }),
			...Array(2).fill({ k: 'd' }),
			...Array(1).fill({ k: 'e' }),
			...Array(1).fill({ k: 'f' }),
			...Array(1).fill({ k: 'g' }),
		];
		const [stat] = calculateCategoricalStatistics(rows, [{ nome: 'k', tipo: 'texto' }]);
		const total = rows.length;
		expect(stat.top5Pct).toBeCloseTo((5 + 4 + 3 + 2 + 1) / total, 4);
		expect(stat.top5Pct).toBeLessThan(1);
	});

	it('runs in linear time on high-cardinality columns', () => {
		const rows = [];
		for (let i = 0; i < 5000; i++) rows.push({ id: `id-${i}` });
		for (let i = 0; i < 100; i++) rows.push({ id: 'shared' });
		const [stat] = calculateCategoricalStatistics(rows, [{ nome: 'id', tipo: 'texto' }]);
		expect(stat.unique).toBe(5001);
		expect(stat.mode).toBe('shared');
		expect(stat.modeCount).toBe(100);
	});

	it('breaks ties on mode by lexicographic order for determinism', () => {
		const [stat] = calculateCategoricalStatistics(
			[{ k: 'b' }, { k: 'a' }, { k: 'c' }],
			[{ nome: 'k', tipo: 'texto' }],
		);
		expect(stat.modeCount).toBe(1);
		expect(stat.mode).toBe('a');
	});
});
