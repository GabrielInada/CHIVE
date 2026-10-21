import { describe, expect, it } from 'vitest';
import {
  applyChartFilterRows,
  createDefaultFilterConfig,
  getCategoricalFilterOptions,
  normalizeFilterConfig,
  toCategoryToken,
} from '../../../src/domain/filters/chartFilter.js';
import { MISSING_TOKEN } from '../../../src/domain/datasets/cellValues.js';

describe('chartFilter', () => {
  it('collects categorical options with missing values', () => {
    const rows = [
      { gender: 'M' },
      { gender: 'F' },
      { gender: 'F' },
      { gender: null },
      { gender: null },
    ];

    const out = getCategoricalFilterOptions(rows, 'gender', { missingLabel: '(ausente)' });
    expect(out.total).toBe(3);
    expect(out.allTokens).toContain(toCategoryToken('F'));
    expect(out.options).toContainEqual({ token: MISSING_TOKEN, label: '(ausente)', count: 2 });
  });

  it('keeps a real "N/A" value apart from the missing bucket', () => {
    const rows = [{ status: 'N/A' }, { status: null }, { status: 'N/A' }];

    const out = getCategoricalFilterOptions(rows, 'status', { missingLabel: '(missing)' });

    expect(out.options).toEqual([
      { token: 'v:N/A', label: 'N/A', count: 2 },
      { token: MISSING_TOKEN, label: '(missing)', count: 1 },
    ]);
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
      include: [toCategoryToken('North'), MISSING_TOKEN],
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

  describe('missing cells in a numeric column', () => {
    // Rows that carry a label but no measurement. Coerced with plain Number()
    // a missing cell reads as 0, so `eq 0` would match it and any bound
    // spanning zero would sweep it in.
    const rows = [{ v: 5 }, { v: null }, { v: 0 }];

    it('does not match missing cells under eq 0, only the genuine zero', () => {
      const result = applyChartFilterRows(rows, {
        column: 'v',
        mode: 'numeric',
        operator: 'eq',
        value: '0',
      }, ['v']);

      expect(result).toEqual([{ v: 0 }]);
    });

    it('excludes missing cells from lt, gt, and between', () => {
      const apply = extra => applyChartFilterRows(rows, {
        column: 'v',
        mode: 'numeric',
        ...extra,
      }, ['v']);

      expect(apply({ operator: 'lt', value: '10' })).toEqual([{ v: 5 }, { v: 0 }]);
      expect(apply({ operator: 'gt', value: '-1' })).toEqual([{ v: 5 }, { v: 0 }]);
      expect(apply({ operator: 'between', min: '-1', max: '10' })).toEqual([{ v: 5 }, { v: 0 }]);
    });

    it('treats a blank bound as unusable and leaves the rows alone', () => {
      const apply = extra => applyChartFilterRows(rows, {
        column: 'v',
        mode: 'numeric',
        ...extra,
      }, ['v']);

      expect(apply({ operator: 'eq', value: '' })).toBe(rows);
      expect(apply({ operator: 'gt', value: '   ' })).toBe(rows);
      expect(apply({ operator: 'between', min: '', max: '10' })).toBe(rows);
    });
  });

  it('returns all rows when filter has no selected column', () => {
    const rows = [{ a: 1 }, { a: 2 }];
    const filtered = applyChartFilterRows(rows, createDefaultFilterConfig(), ['a']);
    expect(filtered).toEqual(rows);
  });

  describe('toCategoryToken', () => {
    it('returns missing token for missing values', () => {
      expect(toCategoryToken(null)).toBe(MISSING_TOKEN);
      expect(toCategoryToken(undefined)).toBe(MISSING_TOKEN);
    });

    it('returns prefixed token for normal values', () => {
      expect(toCategoryToken('hello')).toBe('v:hello');
      expect(toCategoryToken('N/A')).toBe('v:N/A');
      expect(toCategoryToken(42)).toBe('v:42');
      expect(toCategoryToken('2024-01-15')).toBe('v:2024-01-15');
    });
  });

  describe('normalizeFilterConfig', () => {
    it('returns defaults for null or non-object input', () => {
      const result = normalizeFilterConfig(null);
      expect(result.column).toBeNull();
      expect(result.mode).toBe('categorical');
      expect(result.operator).toBe('between');
    });

    it('sets mode to numeric when column is in numericColumns', () => {
      const result = normalizeFilterConfig({ column: 'age' }, ['age', 'score']);
      expect(result.mode).toBe('numeric');
    });

    it('sets mode to categorical when column is not numeric', () => {
      const result = normalizeFilterConfig({ column: 'name' }, ['age']);
      expect(result.mode).toBe('categorical');
    });

    it('normalizes invalid operator to between', () => {
      const result = normalizeFilterConfig({ column: 'x', operator: 'invalid' }, ['x']);
      expect(result.operator).toBe('between');
    });

    it('deduplicates include array and converts to strings', () => {
      const result = normalizeFilterConfig({ column: 'x', include: [1, 1, 'a', 'a'] });
      expect(result.include).toEqual(['1', 'a']);
    });

    it('defaults include to empty array when not array', () => {
      const result = normalizeFilterConfig({ column: 'x', include: 'not array' });
      expect(result.include).toEqual([]);
    });

    it('defaults search to empty string when not string', () => {
      const result = normalizeFilterConfig({ column: 'x', search: 123 });
      expect(result.search).toBe('');
    });

    it('nullifies empty string column', () => {
      const result = normalizeFilterConfig({ column: '  ' });
      expect(result.column).toBeNull();
    });
  });

  describe('getCategoricalFilterOptions edge cases', () => {
    it('returns empty result for non-array rows', () => {
      const result = getCategoricalFilterOptions(null, 'col');
      expect(result).toEqual({ options: [], allTokens: [], total: 0, hasMore: false });
    });

    it('returns empty result for null column name', () => {
      const result = getCategoricalFilterOptions([{ a: 1 }], null);
      expect(result).toEqual({ options: [], allTokens: [], total: 0, hasMore: false });
    });

    it('filters options by search text', () => {
      const rows = [
        { fruit: 'Apple' },
        { fruit: 'Banana' },
        { fruit: 'Avocado' },
      ];
      const result = getCategoricalFilterOptions(rows, 'fruit', { search: 'a' });
      expect(result.total).toBe(3);

      const filtered = getCategoricalFilterOptions(rows, 'fruit', { search: 'ban' });
      expect(filtered.total).toBe(1);
      expect(filtered.options[0].label).toBe('Banana');
    });

    it('limits visible options and sets hasMore flag', () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({ cat: `item${i}` }));
      const result = getCategoricalFilterOptions(rows, 'cat', { limit: 3 });
      expect(result.options.length).toBe(3);
      expect(result.total).toBe(10);
      expect(result.hasMore).toBe(true);
    });

    it('sorts by count descending then label alphabetically', () => {
      const rows = [
        { color: 'blue' },
        { color: 'red' },
        { color: 'red' },
        { color: 'blue' },
        { color: 'green' },
      ];
      const result = getCategoricalFilterOptions(rows, 'color');
      expect(result.options[0].label).toBe('blue');
      expect(result.options[1].label).toBe('red');
      expect(result.options[2].label).toBe('green');
    });
  });

  describe('applyChartFilterRows numeric operators', () => {
    const rows = [
      { score: 10 },
      { score: 20 },
      { score: 30 },
      { score: 40 },
    ];

    it('filters with lt (less than) operator', () => {
      const result = applyChartFilterRows(rows, {
        column: 'score',
        operator: 'lt',
        value: '25',
      }, ['score']);
      expect(result).toEqual([{ score: 10 }, { score: 20 }]);
    });

    it('filters with gt (greater than) operator', () => {
      const result = applyChartFilterRows(rows, {
        column: 'score',
        operator: 'gt',
        value: '25',
      }, ['score']);
      expect(result).toEqual([{ score: 30 }, { score: 40 }]);
    });

    it('returns all rows when between min/max are invalid', () => {
      const result = applyChartFilterRows(rows, {
        column: 'score',
        operator: 'between',
        min: 'abc',
        max: '30',
      }, ['score']);
      expect(result).toEqual(rows);
    });

    it('returns all rows when lt/gt/eq value is invalid', () => {
      const result = applyChartFilterRows(rows, {
        column: 'score',
        operator: 'lt',
        value: 'not a number',
      }, ['score']);
      expect(result).toEqual(rows);
    });

    it('returns empty array for non-array rows input', () => {
      expect(applyChartFilterRows(null, { column: 'x' }, [])).toEqual([]);
    });

    it('returns empty array when categorical include is empty', () => {
      const result = applyChartFilterRows(rows, {
        column: 'score',
        mode: 'categorical',
        include: [],
      }, []);
      expect(result).toEqual([]);
    });

    it('handles between with min > max by swapping', () => {
      const result = applyChartFilterRows(rows, {
        column: 'score',
        operator: 'between',
        min: '30',
        max: '10',
      }, ['score']);
      expect(result).toEqual([{ score: 10 }, { score: 20 }, { score: 30 }]);
    });
  });
});
