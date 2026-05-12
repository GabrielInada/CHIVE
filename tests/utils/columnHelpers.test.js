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
    { nome: 'a', tipo: 'numero' },
    { nome: 'b', tipo: 'texto' },
    { nome: 'c', tipo: 'numero' },
    { nome: 'd', tipo: 'data' },
  ];

  it('filtra colunas visiveis por selecao explicita ou dataset default', () => {
    const dataset = { colunas: columns, colunasSelecionadas: ['a', 'c'] };
    expect(filterVisibleColumns(dataset).map(c => c.nome)).toEqual(['a', 'c']);
    expect(filterVisibleColumns(dataset, ['b']).map(c => c.nome)).toEqual(['b']);
  });

  it('retorna colunas numericas e nomes numericos', () => {
    expect(getNumericColumns(columns).map(c => c.nome)).toEqual(['a', 'c']);
    expect(getNumericColumnNames(columns)).toEqual(['a', 'c']);
  });

  it('retorna colunas categoricas (inclui datas) e nomes', () => {
    expect(getCategoricalColumns(columns).map(c => c.nome)).toEqual(['b', 'd']);
    expect(getCategoricalColumnNames(columns)).toEqual(['b', 'd']);
  });

  it('retorna colunas de data e nomes de data', () => {
    expect(getDateColumns(columns).map(c => c.nome)).toEqual(['d']);
    expect(getDateColumnNames(columns)).toEqual(['d']);
  });
});
