import { describe, expect, it } from 'vitest';
import {
  FILTER_MISSING_TOKEN,
  applyChartFilterRows,
  createDefaultFilterConfig,
  getCategoricalFilterOptions,
  toCategoryToken,
} from '../../src/utils/chartFilters.js';

describe('chartFilters', () => {
  it('collects categorical options with missing values', () => {
    const rows = [
      { gender: 'M' },
      { gender: 'F' },
      { gender: 'F' },
      { gender: '' },
      { gender: null },
    ];

    const out = getCategoricalFilterOptions(rows, 'gender', { missingLabel: '(missing)' });
    expect(out.total).toBe(3);
    expect(out.allTokens).toContain(toCategoryToken('F'));
    expect(out.allTokens).toContain(FILTER_MISSING_TOKEN);
  });

  it('filters rows for categorical include list', () => {
    const rows = [
      { region: 'North' },
      { region: 'South' },
      { region: null },
    ];

    const filtered = applyChartFilterRows(rows, {
      column: 'region',
      mode: 'categorical',
      include: [toCategoryToken('North'), FILTER_MISSING_TOKEN],
    }, []);

    expect(filtered).toEqual([{ region: 'North' }, { region: null }]);
  });

  it('filters rows for numeric between and equality operators', () => {
    const rows = [
      { age: 10 },
      { age: 18 },
      { age: 22 },
      { age: 30 },
    ];

    const between = applyChartFilterRows(rows, {
      column: 'age',
      mode: 'numeric',
      operator: 'between',
      min: '18',
      max: '25',
    }, ['age']);

    const equal = applyChartFilterRows(rows, {
      column: 'age',
      mode: 'numeric',
      operator: 'eq',
      value: '22',
    }, ['age']);

    expect(between).toEqual([{ age: 18 }, { age: 22 }]);
    expect(equal).toEqual([{ age: 22 }]);
  });

  it('returns all rows when filter has no selected column', () => {
    const rows = [{ a: 1 }, { a: 2 }];
    const filtered = applyChartFilterRows(rows, createDefaultFilterConfig(), ['a']);
    expect(filtered).toEqual(rows);
  });
});
