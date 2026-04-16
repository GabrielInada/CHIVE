import { describe, expect, it } from 'vitest';
import {
  FILTER_MISSING_TOKEN,
  FILTER_CATEGORY_LIMIT,
  applyChartFilterRows,
  createDefaultFilterConfig,
  getCategoricalFilterOptions,
  isMissingCategoryValue,
  normalizeFilterConfig,
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

  describe('isMissingCategoryValue', () => {
    it('identifies null, undefined, and empty strings as missing', () => {
      expect(isMissingCategoryValue(null)).toBe(true);
      expect(isMissingCategoryValue(undefined)).toBe(true);
      expect(isMissingCategoryValue('')).toBe(true);
      expect(isMissingCategoryValue('  ')).toBe(true);
    });

    it('identifies non-empty values as not missing', () => {
      expect(isMissingCategoryValue('a')).toBe(false);
      expect(isMissingCategoryValue(0)).toBe(false);
    });
  });

  describe('toCategoryToken', () => {
    it('returns missing token for missing values', () => {
      expect(toCategoryToken(null)).toBe(FILTER_MISSING_TOKEN);
      expect(toCategoryToken(undefined)).toBe(FILTER_MISSING_TOKEN);
    });

    it('returns prefixed token for normal values', () => {
      expect(toCategoryToken('hello')).toBe('v:hello');
      expect(toCategoryToken(42)).toBe('v:42');
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

    it('skips rows with non-numeric values in numeric filter', () => {
      const mixed = [
        { val: 10 },
        { val: 'text' },
        { val: 30 },
      ];
      const result = applyChartFilterRows(mixed, {
        column: 'val',
        operator: 'gt',
        value: '5',
      }, ['val']);
      expect(result).toEqual([{ val: 10 }, { val: 30 }]);
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
