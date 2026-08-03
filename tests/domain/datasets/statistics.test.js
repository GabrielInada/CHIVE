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

  it.each([
    ['empty strings', ''],
    ['whitespace', '   '],
  ])('excludes %s left in a numeric column by the ingest normalizer', (_label, missing) => {
    // `isNaN('')` is false, so blanks used to reach d3: they took over `min`
    // (comparing as 0) and counted as 0 in `mean`/`median`.
    const stats = calculateStatistics(
      [{ val: 10 }, { val: missing }, { val: 20 }, { val: missing }],
      [{ name: 'val', type: 'number' }],
    );

    expect(stats[0].n).toBe(2);
    expect(stats[0].min).toBe(10);
    expect(stats[0].max).toBe(20);
    expect(stats[0].mean).toBe(15);
    expect(stats[0].median).toBe(15);
  });

  it('returns numbers, not strings, for a column of numeric strings', () => {
    // d3's min/max compare without coercing, so `min(['10','20'])` is the
    // string '10'. NumericColumnStats promises numbers.
    const stats = calculateStatistics(
      [{ val: '10' }, { val: '20' }, { val: '5' }],
      [{ name: 'val', type: 'number' }],
    );

    expect(stats[0].min).toBe(5);
    expect(stats[0].max).toBe(20);
    expect(typeof stats[0].min).toBe('number');
    expect(typeof stats[0].max).toBe('number');
    expect(typeof stats[0].mean).toBe('number');
    expect(typeof stats[0].median).toBe('number');
  });

  it('reports the real minimum for large-offset survey coordinates with blank rows', () => {
    const stats = calculateStatistics(
      [
        { x: 784431.551 },
        { x: 784411.896 },
        { x: 784496.014 },
        { x: '' },
      ],
      [{ name: 'x', type: 'number' }],
    );

    expect(stats[0].n).toBe(3);
    expect(stats[0].min).toBe(784411.896);
    expect(stats[0].max).toBe(784496.014);
  });

  it('keeps a genuine zero, which is a measurement and not a blank', () => {
    const stats = calculateStatistics(
      [{ val: 0 }, { val: 10 }, { val: '' }],
      [{ name: 'val', type: 'number' }],
    );

    expect(stats[0].n).toBe(2);
    expect(stats[0].min).toBe(0);
    expect(stats[0].mean).toBe(5);
  });
});
