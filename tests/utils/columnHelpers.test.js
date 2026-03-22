// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  filterVisibleColumns,
  getNumericColumns,
  getNumericColumnNames,
  getCategoricalColumns,
  getCategoricalColumnNames,
} from '../../src/utils/columnHelpers.js';

describe('columnHelpers', () => {
  const columns = [
    { nome: 'a', tipo: 'numero' },
    { nome: 'b', tipo: 'texto' },
    { nome: 'c', tipo: 'numero' },
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

  it('retorna colunas categoricas e nomes categoricos', () => {
    expect(getCategoricalColumns(columns).map(c => c.nome)).toEqual(['b']);
    expect(getCategoricalColumnNames(columns)).toEqual(['b']);
  });
});
