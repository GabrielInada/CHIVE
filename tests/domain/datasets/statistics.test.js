import { describe, expect, it } from 'vitest';
import { calculateStatistics } from '../../../src/domain/datasets/statistics.js';

describe('calculateStatistics edge cases', () => {
  it('returns empty array for columns without number type', () => {
    const stats = calculateStatistics(
      [{ a: 'x' }, { a: 'y' }],
      [{ name: 'a', type: 'text' }],
    );
    expect(stats).toEqual([]);
  });

  it('ignores missing cells in statistics calculation', () => {
    // Coerced with plain Number(), a missing cell would count as 0 in
    // `mean`/`median` and take over `min`.
    const stats = calculateStatistics(
      [{ val: 10 }, { val: null }, { val: 20 }, { val: null }],
      [{ name: 'val', type: 'number' }],
    );
    expect(stats.length).toBe(1);
    expect(stats[0].n).toBe(2);
    expect(stats[0].min).toBe(10);
    expect(stats[0].max).toBe(20);
    expect(stats[0].mean).toBe(15);
    expect(stats[0].median).toBe(15);
  });

  it('ignores numeric columns where all values are missing', () => {
    const stats = calculateStatistics(
      [{ val: null }, { val: null }],
      [{ name: 'val', type: 'number' }],
    );
    expect(stats).toEqual([]);
  });

  it('reports the real minimum for large-offset survey coordinates with missing rows', () => {
    const stats = calculateStatistics(
      [
        { x: 784431.551 },
        { x: 784411.896 },
        { x: 784496.014 },
        { x: null },
      ],
      [{ name: 'x', type: 'number' }],
    );

    expect(stats[0].n).toBe(3);
    expect(stats[0].min).toBe(784411.896);
    expect(stats[0].max).toBe(784496.014);
  });

  it('keeps a genuine zero, which is a measurement and not a missing cell', () => {
    const stats = calculateStatistics(
      [{ val: 0 }, { val: 10 }, { val: null }],
      [{ name: 'val', type: 'number' }],
    );

    expect(stats[0].n).toBe(2);
    expect(stats[0].min).toBe(0);
    expect(stats[0].mean).toBe(5);
  });
});
