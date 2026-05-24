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
} from '../../src/utils/columnHelpers.js';

describe('columnHelpers', () => {
  const columns = [
    { name: 'a', type: 'number' },
    { name: 'b', type: 'text' },
    { name: 'c', type: 'number' },
    { name: 'd', type: 'date' },
  ];

  it('filtra columns visiveis por selecao explicita ou dataset default', () => {
    const dataset = { columns: columns, selectedColumns: ['a', 'c'] };
    expect(filterVisibleColumns(dataset).map(c => c.name)).toEqual(['a', 'c']);
    expect(filterVisibleColumns(dataset, ['b']).map(c => c.name)).toEqual(['b']);
  });

  it('retorna columns numericas e nomes numericos', () => {
    expect(getNumericColumns(columns).map(c => c.name)).toEqual(['a', 'c']);
    expect(getNumericColumnNames(columns)).toEqual(['a', 'c']);
  });

  it('retorna columns categoricas (inclui datas) e nomes', () => {
    expect(getCategoricalColumns(columns).map(c => c.name)).toEqual(['b', 'd']);
    expect(getCategoricalColumnNames(columns)).toEqual(['b', 'd']);
  });

  it('retorna columns de data e nomes de data', () => {
    expect(getDateColumns(columns).map(c => c.name)).toEqual(['d']);
    expect(getDateColumnNames(columns)).toEqual(['d']);
  });
});
