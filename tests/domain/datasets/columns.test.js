// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  filterVisibleColumns,
  getNumericColumns,
  getNumericColumnNames,
  getCategoricalColumns,
  getCategoricalColumnNames,
  getDateColumns,
  getDateColumnNames,
  getDatasetColumnNames,
  normalizeColumnNameList,
} from '../../../src/domain/datasets/columns.js';

describe('columns', () => {
  const columns = [
    { name: 'a', type: 'number' },
    { name: 'b', type: 'text' },
    { name: 'c', type: 'number' },
    { name: 'd', type: 'date' },
  ];

  it('filters visible columns by explicit selection or dataset default', () => {
    const dataset = { columns: columns, selectedColumns: ['a', 'c'] };
    expect(filterVisibleColumns(dataset).map(c => c.name)).toEqual(['a', 'c']);
    expect(filterVisibleColumns(dataset, ['b']).map(c => c.name)).toEqual(['b']);
  });

  it('returns numeric columns and numeric names', () => {
    expect(getNumericColumns(columns).map(c => c.name)).toEqual(['a', 'c']);
    expect(getNumericColumnNames(columns)).toEqual(['a', 'c']);
  });

  it('returns categorical columns (including dates) and names', () => {
    expect(getCategoricalColumns(columns).map(c => c.name)).toEqual(['b', 'd']);
    expect(getCategoricalColumnNames(columns)).toEqual(['b', 'd']);
  });

  it('returns date columns and date names', () => {
    expect(getDateColumns(columns).map(c => c.name)).toEqual(['d']);
    expect(getDateColumnNames(columns)).toEqual(['d']);
  });
});

describe('normalizeColumnNameList', () => {
  it('drops non-string and empty entries', () => {
    expect(normalizeColumnNameList(['a', '', null, 0, undefined, 'b'])).toEqual(['a', 'b']);
  });

  it('de-duplicates keeping first occurrence', () => {
    expect(normalizeColumnNameList(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c']);
  });

  it('returns [] for non-array / undefined input', () => {
    expect(normalizeColumnNameList(undefined)).toEqual([]);
    expect(normalizeColumnNameList(null)).toEqual([]);
    expect(normalizeColumnNameList('a')).toEqual([]);
    expect(normalizeColumnNameList({})).toEqual([]);
  });

  it('keeps only names in a provided allowed set', () => {
    const allowed = new Set(['a', 'c']);
    expect(normalizeColumnNameList(['a', 'b', 'c', 'd'], { allowed })).toEqual(['a', 'c']);
  });

  it('treats an empty allowed set as allow-nothing, distinct from null', () => {
    expect(normalizeColumnNameList(['a', 'b'], { allowed: new Set() })).toEqual([]);
    expect(normalizeColumnNameList(['a', 'b'], { allowed: null })).toEqual(['a', 'b']);
  });

  it('hard-caps to max', () => {
    expect(normalizeColumnNameList(['a', 'b', 'c', 'd'], { max: 2 })).toEqual(['a', 'b']);
  });

  it('fails closed on an invalid max (0, negative, NaN, -Infinity → [])', () => {
    expect(normalizeColumnNameList(['a', 'b'], { max: 0 })).toEqual([]);
    expect(normalizeColumnNameList(['a', 'b'], { max: -1 })).toEqual([]);
    expect(normalizeColumnNameList(['a', 'b'], { max: NaN })).toEqual([]);
    expect(normalizeColumnNameList(['a', 'b'], { max: -Infinity })).toEqual([]);
  });

  it('floors a fractional max', () => {
    expect(normalizeColumnNameList(['a', 'b', 'c'], { max: 2.9 })).toEqual(['a', 'b']);
  });

  it('only explicit Infinity (and the default) is uncapped', () => {
    expect(normalizeColumnNameList(['a', 'b', 'c'], { max: Infinity })).toEqual(['a', 'b', 'c']);
    expect(normalizeColumnNameList(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });
});

describe('getDatasetColumnNames', () => {
  it('extracts names from { name } column objects', () => {
    const dataset = { columns: [{ name: 'a', type: 'number' }, { name: 'b', type: 'text' }] };
    expect(getDatasetColumnNames(dataset)).toEqual(['a', 'b']);
  });

  it('extracts names from bare-string columns', () => {
    expect(getDatasetColumnNames({ columns: ['a', 'b'] })).toEqual(['a', 'b']);
  });

  it('returns undefined when columns is not an array (no trustworthy context)', () => {
    expect(getDatasetColumnNames({ columns: undefined })).toBeUndefined();
    expect(getDatasetColumnNames({})).toBeUndefined();
    expect(getDatasetColumnNames(null)).toBeUndefined();
  });

  it('returns [] for a genuinely empty columns array', () => {
    expect(getDatasetColumnNames({ columns: [] })).toEqual([]);
  });

  it('drops invalid entries and de-duplicates', () => {
    const dataset = { columns: [{ name: 'a' }, 'a', { type: 'number' }, '', 'b'] };
    expect(getDatasetColumnNames(dataset)).toEqual(['a', 'b']);
  });
});
