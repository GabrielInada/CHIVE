// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  detectType,
  detectDelimiter,
  parseCsv,
  parseJson,
  processData,
  calculateStatistics,
  formatFileSize,
  joinDatasets,
} from '../../src/services/dataService.js';

describe('dataService', () => {
  it('detecta tipo numero e texto corretamente', () => {
    expect(detectType(['1', '2', '3', '4'])).toBe('numero');
    expect(detectType(['abc', 'def', 'ghi'])).toBe('texto');
  });

  it('parseia CSV e rejeita CSV vazio', () => {
    const rows = parseCsv('a,b\n1,2\n3,4');
    expect(rows.length).toBe(2);
    expect(rows[0].a).toBe('1');

    expect(() => parseCsv('')).toThrow('O arquivo CSV está vazio.');
  });

  it('parseia JSON em formatos suportados e rejeita inválido', () => {
    const arr = parseJson('[{"a":1},{"a":2}]');
    expect(arr.length).toBe(2);

    const nested = parseJson('{"items":[{"x":1}]}');
    expect(nested.length).toBe(1);

    expect(() => parseJson('{')).toThrow('O arquivo JSON contém erros de sintaxe. Verifique o formato.');
    expect(() => parseJson('{"foo":1}')).toThrow('Formato JSON não reconhecido. O arquivo deve ser um array de objetos: [{...}, {...}]');
  });

  it('processa dados convertendo colunas numericas e calcula estatisticas', () => {
    const input = [
      { a: '1', b: 'x' },
      { a: '2', b: 'y' },
      { a: '3', b: 'z' },
    ];

    const processed = processData(input);
    expect(processed.colunas.find(c => c.nome === 'a')?.tipo).toBe('numero');
    expect(typeof processed.dados[0].a).toBe('number');

    const stats = calculateStatistics(processed.dados, processed.colunas);
    expect(stats.length).toBe(1);
    expect(stats[0].nome).toBe('a');
    expect(stats[0].min).toBe(1);
    expect(stats[0].max).toBe(3);
    expect(stats[0].media).toBe(2);
  });

  it('retorna estrutura vazia quando processData recebe array vazio', () => {
    const processed = processData([]);
    expect(processed).toEqual({ dados: [], colunas: [] });
  });

  it('executa join com multiplas chaves e prefixa colunas conflitantes', () => {
    const leftRows = [
      { id: 'A1', region: 'North', amount: 10, owner: 'Ana' },
      { id: 'B2', region: 'South', amount: 7, owner: 'Beto' },
    ];
    const rightRows = [
      { key: 'a1', area: 'north', amount: 100, status: 'ok' },
      { key: 'C3', area: 'West', amount: 80, status: 'late' },
    ];

    const result = joinDatasets({
      leftRows,
      rightRows,
      leftKeys: ['id', 'region'],
      rightKeys: ['key', 'area'],
      joinType: 'inner',
      leftColumns: ['id', 'amount'],
      rightColumns: ['amount', 'status'],
      leftDatasetName: 'sales.csv',
      rightDatasetName: 'targets.csv',
      normalization: { trim: true, caseSensitive: false },
    });

    expect(result.rows.length).toBe(1);
    expect(result.rows[0]).toEqual({
      id: 'A1',
      'sales.amount': 10,
      'targets.amount': 100,
      status: 'ok',
    });
  });

  it('suporta full join com linhas nao correspondentes', () => {
    const result = joinDatasets({
      leftRows: [{ id: '1', value: 'L1' }],
      rightRows: [{ id: '2', value: 'R2' }],
      leftKeys: ['id'],
      rightKeys: ['id'],
      joinType: 'full',
      leftColumns: ['id', 'value'],
      rightColumns: ['id', 'value'],
      leftDatasetName: 'left.csv',
      rightDatasetName: 'right.csv',
    });

    expect(result.rows.length).toBe(2);
    expect(result.outputColumns).toContain('left.id');
    expect(result.outputColumns).toContain('right.id');
  });

  it('formata tamanhos de arquivo em B KB e MB', () => {
    expect(formatFileSize(100)).toBe('100 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });

  it('detecta delimitador correto a partir da primeira linha', () => {
    expect(detectDelimiter('a,b,c')).toBe(',');
    expect(detectDelimiter('a;b;c')).toBe(';');
    expect(detectDelimiter('a\tb\tc')).toBe('\t');
    expect(detectDelimiter('a|b|c')).toBe('|');
    expect(detectDelimiter('')).toBe(','); // fallback
    expect(detectDelimiter('nenhum_delimitador')).toBe(','); // fallback
  });

  it('detecta tiebreaker: prefere virgula quando contagens sao iguais', () => {
    // one comma and one semicolon — comma has priority
    expect(detectDelimiter('a,b;c')).toBe(',');
  });

  it('parseia TSV com auto-deteccao de delimitador', () => {
    const rows = parseCsv('a\tb\n1\t2\n3\t4');
    expect(rows.length).toBe(2);
    expect(rows[0].a).toBe('1');
    expect(rows[0].b).toBe('2');
  });

  it('parseia arquivo delimitado por ponto-e-virgula com auto-deteccao', () => {
    const rows = parseCsv('a;b\n1;2\n3;4');
    expect(rows.length).toBe(2);
    expect(rows[0].a).toBe('1');
  });

  it('parseia arquivo delimitado por pipe com auto-deteccao', () => {
    const rows = parseCsv('a|b\n1|2\n3|4');
    expect(rows.length).toBe(2);
    expect(rows[0].a).toBe('1');
  });
});
