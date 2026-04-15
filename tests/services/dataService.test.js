// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  detectType,
  detectDecimalSeparator,
  normalizeNumericString,
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

  describe('normalizeNumericString', () => {
    it('nao altera valores em formato US quando decimal e ponto', () => {
      expect(normalizeNumericString('3.14', '.')).toBe('3.14');
      expect(normalizeNumericString('1,234.56', '.')).toBe('1234.56');
      expect(normalizeNumericString('1000', '.')).toBe('1000');
    });

    it('converte formato europeu para formato Number() quando decimal e virgula', () => {
      expect(normalizeNumericString('3,14', ',')).toBe('3.14');
      expect(normalizeNumericString('1.234,56', ',')).toBe('1234.56');
      expect(normalizeNumericString('1.000', ',')).toBe('1000');
    });
  });

  describe('detectDecimalSeparator', () => {
    it('retorna ponto como fallback para array vazio ou sem separadores', () => {
      expect(detectDecimalSeparator([])).toBe('.');
      expect(detectDecimalSeparator(['abc', 'def'])).toBe('.');
      expect(detectDecimalSeparator(['100', '200', '300'])).toBe('.');
    });

    it('Stage 1: detecta ponto como decimal quando ambos separadores presentes (formato US)', () => {
      expect(detectDecimalSeparator(['1,234.56', '2,000.75'])).toBe('.');
    });

    it('Stage 1: detecta virgula como decimal quando ambos separadores presentes (formato europeu)', () => {
      expect(detectDecimalSeparator(['1.234,56', '2.000,75'])).toBe(',');
    });

    it('Stage 2: detecta ponto como decimal por contagem de digitos (1-2 casas)', () => {
      expect(detectDecimalSeparator(['3.14', '2.71', '1.41'])).toBe('.');
    });

    it('Stage 2: detecta virgula como decimal por contagem de digitos (1-2 casas)', () => {
      expect(detectDecimalSeparator(['3,14', '2,71', '1,41'])).toBe(',');
    });

    it('Stage 2: detecta ponto como decimal com mais de 3 casas decimais', () => {
      expect(detectDecimalSeparator(['3.14159', '2.71828'])).toBe('.');
    });

    it('Stage 2b: detecta virgula como decimal para inteiros europeus como 1.000', () => {
      expect(detectDecimalSeparator(['1.000', '2.000', '50.000'])).toBe(',');
    });

    it('Stage 3: fallback por NaN - reverte quando separador detectado produz muitos NaN', () => {
      // All values have exactly 3 decimal places in European format.
      // Stages 1-2b skip them as ambiguous, fall back to '.',
      // but Stage 3 sees high NaN rate and switches to ','.
      const values = ['3,141', '2,718', '1,414', '1,732', '0,001'];
      expect(detectDecimalSeparator(values)).toBe(',');
    });

    it('ponto vence empates como separador de maior prioridade', () => {
      // Equal evidence for both - dot wins
      expect(detectDecimalSeparator(['3.14', '3,14'])).toBe('.');
    });
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

  describe('processData com separador decimal europeu', () => {
    it('detecta e converte colunas numericas em formato europeu (virgula decimal)', () => {
      const input = [
        { valor: '3,14', nome: 'pi' },
        { valor: '2,71', nome: 'e' },
        { valor: '1,41', nome: 'sqrt2' },
      ];
      const result = processData(input);
      expect(result.colunas.find(c => c.nome === 'valor')?.tipo).toBe('numero');
      expect(result.dados[0].valor).toBeCloseTo(3.14);
      expect(result.dados[1].valor).toBeCloseTo(2.71);
    });

    it('detecta e converte inteiros europeus com ponto como separador de milhar', () => {
      const input = [
        { populacao: '1.000', pais: 'A' },
        { populacao: '50.000', pais: 'B' },
        { populacao: '2.000', pais: 'C' },
      ];
      const result = processData(input);
      expect(result.colunas.find(c => c.nome === 'populacao')?.tipo).toBe('numero');
      expect(result.dados[0].populacao).toBe(1000);
      expect(result.dados[1].populacao).toBe(50000);
    });

    it('detecta e converte formato europeu completo com milhar e decimal', () => {
      const input = [
        { preco: '1.234,56' },
        { preco: '2.000,75' },
      ];
      const result = processData(input);
      expect(result.colunas.find(c => c.nome === 'preco')?.tipo).toBe('numero');
      expect(result.dados[0].preco).toBeCloseTo(1234.56);
    });

    it('converte formato US com separador de milhar (valores entre aspas no CSV)', () => {
      const csv = 'id,value\n1,"1,234.56"\n2,"2,345.67"\n3,"3,456.78"';
      const rows = parseCsv(csv);
      const result = processData(rows);
      expect(result.colunas.find(c => c.nome === 'value')?.tipo).toBe('numero');
      expect(result.dados[0].value).toBeCloseTo(1234.56);
      expect(result.dados[1].value).toBeCloseTo(2345.67);
    });

    it('converte formato europeu end-to-end com delimitador ponto-e-virgula', () => {
      const csv = 'id;valor\n1;3,14\n2;2,71\n3;1,41';
      const rows = parseCsv(csv);
      const result = processData(rows);
      expect(result.colunas.find(c => c.nome === 'valor')?.tipo).toBe('numero');
      expect(result.dados[0].valor).toBeCloseTo(3.14);
      expect(result.dados[2].valor).toBeCloseTo(1.41);
    });

    it('converte numeros com alta precisao decimal', () => {
      const input = [
        { value: '1234.56789' },
        { value: '2345.67891' },
        { value: '3456.78912' },
      ];
      const result = processData(input);
      expect(result.colunas.find(c => c.nome === 'value')?.tipo).toBe('numero');
      expect(result.dados[0].value).toBeCloseTo(1234.56789);
    });

    it('converte notacao cientifica corretamente', () => {
      const input = [
        { value: '1.23456e3' },
        { value: '2.34567e3' },
        { value: '3.45678e3' },
      ];
      const result = processData(input);
      expect(result.colunas.find(c => c.nome === 'value')?.tipo).toBe('numero');
      expect(result.dados[0].value).toBeCloseTo(1234.56);
      expect(result.dados[1].value).toBeCloseTo(2345.67);
    });

    it('converte numeros negativos com sinal de menos', () => {
      const input = [
        { value: '-1234.56' },
        { value: '-2345.67' },
        { value: '-3456.78' },
      ];
      const result = processData(input);
      expect(result.colunas.find(c => c.nome === 'value')?.tipo).toBe('numero');
      expect(result.dados[0].value).toBeCloseTo(-1234.56);
      expect(result.dados[2].value).toBeCloseTo(-3456.78);
    });

    it('converte valores decimais com zero inicial', () => {
      const input = [
        { value: '0.56' },
        { value: '0.78' },
        { value: '0.91' },
      ];
      const result = processData(input);
      expect(result.colunas.find(c => c.nome === 'value')?.tipo).toBe('numero');
      expect(result.dados[0].value).toBeCloseTo(0.56);
      expect(result.dados[2].value).toBeCloseTo(0.91);
    });

    it('converte inteiros US com separador de milhar', () => {
      const csv = 'id,value\n1,"1,000"\n2,"2,000"\n3,"3,000"\n4,"4,000"\n5,"5,000"';
      const rows = parseCsv(csv);
      const result = processData(rows);
      expect(result.colunas.find(c => c.nome === 'value')?.tipo).toBe('numero');
      expect(result.dados[0].value).toBe(1000);
      expect(result.dados[4].value).toBe(5000);
    });

    it('nao regride para arquivos em formato US padrao', () => {
      const input = [
        { a: '1', b: 'x' },
        { a: '2', b: 'y' },
        { a: '3', b: 'z' },
      ];
      const result = processData(input);
      expect(result.colunas.find(c => c.nome === 'a')?.tipo).toBe('numero');
      expect(result.dados[0].a).toBe(1);
    });
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
