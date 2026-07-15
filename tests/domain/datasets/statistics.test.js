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

  it('ignores null and NaN values in statistics calculation', () => {
    const stats = calculateStatistics(
      [{ val: 10 }, { val: null }, { val: 20 }, { val: NaN }],
      [{ name: 'val', type: 'number' }],
    );
    expect(stats.length).toBe(1);
    expect(stats[0].n).toBe(2);
    expect(stats[0].min).toBe(10);
    expect(stats[0].max).toBe(20);
    expect(stats[0].mean).toBe(15);
  });

  it('ignores numeric columns where all values are null', () => {
    const stats = calculateStatistics(
      [{ val: null }, { val: undefined }],
      [{ name: 'val', type: 'number' }],
    );
    expect(stats).toEqual([]);
  });
});
