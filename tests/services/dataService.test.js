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
  it('detects number and text types correctly', () => {
    expect(detectType(['1', '2', '3', '4'])).toBe('number');
    expect(detectType(['abc', 'def', 'ghi'])).toBe('text');
  });

  describe('normalizeNumericString', () => {
    it('does not alter US-format values when decimal is dot', () => {
      expect(normalizeNumericString('3.14', '.')).toBe('3.14');
      expect(normalizeNumericString('1,234.56', '.')).toBe('1234.56');
      expect(normalizeNumericString('1000', '.')).toBe('1000');
    });

    it('converts European format to Number() format when decimal is comma', () => {
      expect(normalizeNumericString('3,14', ',')).toBe('3.14');
      expect(normalizeNumericString('1.234,56', ',')).toBe('1234.56');
      expect(normalizeNumericString('1.000', ',')).toBe('1000');
    });
  });

  describe('detectDecimalSeparator', () => {
    it('returns dot as fallback for empty array or no separators', () => {
      expect(detectDecimalSeparator([])).toBe('.');
      expect(detectDecimalSeparator(['abc', 'def'])).toBe('.');
      expect(detectDecimalSeparator(['100', '200', '300'])).toBe('.');
    });

    it('Stage 1: detects dot as decimal when both separators present (US format)', () => {
      expect(detectDecimalSeparator(['1,234.56', '2,000.75'])).toBe('.');
    });

    it('Stage 1: detects comma as decimal when both separators present (European format)', () => {
      expect(detectDecimalSeparator(['1.234,56', '2.000,75'])).toBe(',');
    });

    it('Stage 2: detects dot as decimal by digit count (1-2 places)', () => {
      expect(detectDecimalSeparator(['3.14', '2.71', '1.41'])).toBe('.');
    });

    it('Stage 2: detects comma as decimal by digit count (1-2 places)', () => {
      expect(detectDecimalSeparator(['3,14', '2,71', '1,41'])).toBe(',');
    });

    it('Stage 2: detects dot as decimal with more than 3 decimal places', () => {
      expect(detectDecimalSeparator(['3.14159', '2.71828'])).toBe('.');
    });

    it('Stage 2b: detects comma as decimal for European integers like 1.000', () => {
      expect(detectDecimalSeparator(['1.000', '2.000', '50.000'])).toBe(',');
    });

    it('Stage 3: NaN fallback, reverts when detected separator produces many NaN', () => {
      // All values have exactly 3 decimal places in European format.
      // Stages 1-2b skip them as ambiguous, fall back to '.',
      // but Stage 3 sees high NaN rate and switches to ','.
      const values = ['3,141', '2,718', '1,414', '1,732', '0,001'];
      expect(detectDecimalSeparator(values)).toBe(',');
    });

    it('dot wins ties as the higher-priority separator', () => {
      // Equal evidence for both: dot wins
      expect(detectDecimalSeparator(['3.14', '3,14'])).toBe('.');
    });
  });

  it('parses CSV and rejects empty CSV', () => {
    const rows = parseCsv('a,b\n1,2\n3,4');
    expect(rows.length).toBe(2);
    expect(rows[0].a).toBe('1');

    expect(() => parseCsv('')).toThrow('The CSV file is empty.');
  });

  it('parses JSON in supported formats and rejects invalid', () => {
    const arr = parseJson('[{"a":1},{"a":2}]');
    expect(arr.length).toBe(2);

    const nested = parseJson('{"items":[{"x":1}]}');
    expect(nested.length).toBe(1);

    expect(() => parseJson('{')).toThrow('JSON file contains syntax errors. Verify the format.');
    expect(() => parseJson('{"foo":1}')).toThrow('Unrecognized JSON format. The file must be an array of objects: [{...}, {...}]');
  });

  it('processes rows converting numeric columns and computes statistics', () => {
    const input = [
      { a: '1', b: 'x' },
      { a: '2', b: 'y' },
      { a: '3', b: 'z' },
    ];

    const processed = processData(input);
    expect(processed.columns.find(c => c.name === 'a')?.type).toBe('number');
    expect(typeof processed.rows[0].a).toBe('number');

    const stats = calculateStatistics(processed.rows, processed.columns);
    expect(stats.length).toBe(1);
    expect(stats[0].name).toBe('a');
    expect(stats[0].min).toBe(1);
    expect(stats[0].max).toBe(3);
    expect(stats[0].mean).toBe(2);
  });

  describe('processData with European decimal separator', () => {
    it('detects and converts numeric columns in European format (comma decimal)', () => {
      const input = [
        { valor: '3,14', name: 'pi' },
        { valor: '2,71', name: 'e' },
        { valor: '1,41', name: 'sqrt2' },
      ];
      const result = processData(input);
      expect(result.columns.find(c => c.name === 'valor')?.type).toBe('number');
      expect(result.rows[0].valor).toBeCloseTo(3.14);
      expect(result.rows[1].valor).toBeCloseTo(2.71);
    });

    it('detects and converts European integers with dot as thousand separator', () => {
      const input = [
        { populacao: '1.000', pais: 'A' },
        { populacao: '50.000', pais: 'B' },
        { populacao: '2.000', pais: 'C' },
      ];
      const result = processData(input);
      expect(result.columns.find(c => c.name === 'populacao')?.type).toBe('number');
      expect(result.rows[0].populacao).toBe(1000);
      expect(result.rows[1].populacao).toBe(50000);
    });

    it('detects and converts full European format with thousand and decimal', () => {
      const input = [
        { preco: '1.234,56' },
        { preco: '2.000,75' },
      ];
      const result = processData(input);
      expect(result.columns.find(c => c.name === 'preco')?.type).toBe('number');
      expect(result.rows[0].preco).toBeCloseTo(1234.56);
    });

    it('converts US format with thousand separator (values quoted in CSV)', () => {
      const csv = 'id,value\n1,"1,234.56"\n2,"2,345.67"\n3,"3,456.78"';
      const rows = parseCsv(csv);
      const result = processData(rows);
      expect(result.columns.find(c => c.name === 'value')?.type).toBe('number');
      expect(result.rows[0].value).toBeCloseTo(1234.56);
      expect(result.rows[1].value).toBeCloseTo(2345.67);
    });

    it('converts European format end-to-end with semicolon delimiter', () => {
      const csv = 'id;valor\n1;3,14\n2;2,71\n3;1,41';
      const rows = parseCsv(csv);
      const result = processData(rows);
      expect(result.columns.find(c => c.name === 'valor')?.type).toBe('number');
      expect(result.rows[0].valor).toBeCloseTo(3.14);
      expect(result.rows[2].valor).toBeCloseTo(1.41);
    });

    it('converts numbers with high decimal precision', () => {
      const input = [
        { value: '1234.56789' },
        { value: '2345.67891' },
        { value: '3456.78912' },
      ];
      const result = processData(input);
      expect(result.columns.find(c => c.name === 'value')?.type).toBe('number');
      expect(result.rows[0].value).toBeCloseTo(1234.56789);
    });

    it('converts scientific notation correctly', () => {
      const input = [
        { value: '1.23456e3' },
        { value: '2.34567e3' },
        { value: '3.45678e3' },
      ];
      const result = processData(input);
      expect(result.columns.find(c => c.name === 'value')?.type).toBe('number');
      expect(result.rows[0].value).toBeCloseTo(1234.56);
      expect(result.rows[1].value).toBeCloseTo(2345.67);
    });

    it('converts negative numbers with minus sign', () => {
      const input = [
        { value: '-1234.56' },
        { value: '-2345.67' },
        { value: '-3456.78' },
      ];
      const result = processData(input);
      expect(result.columns.find(c => c.name === 'value')?.type).toBe('number');
      expect(result.rows[0].value).toBeCloseTo(-1234.56);
      expect(result.rows[2].value).toBeCloseTo(-3456.78);
    });

    it('converts decimal values with leading zero', () => {
      const input = [
        { value: '0.56' },
        { value: '0.78' },
        { value: '0.91' },
      ];
      const result = processData(input);
      expect(result.columns.find(c => c.name === 'value')?.type).toBe('number');
      expect(result.rows[0].value).toBeCloseTo(0.56);
      expect(result.rows[2].value).toBeCloseTo(0.91);
    });

    it('converts US integers with thousand separator', () => {
      const csv = 'id,value\n1,"1,000"\n2,"2,000"\n3,"3,000"\n4,"4,000"\n5,"5,000"';
      const rows = parseCsv(csv);
      const result = processData(rows);
      expect(result.columns.find(c => c.name === 'value')?.type).toBe('number');
      expect(result.rows[0].value).toBe(1000);
      expect(result.rows[4].value).toBe(5000);
    });

    it('does not regress for standard US-format files', () => {
      const input = [
        { a: '1', b: 'x' },
        { a: '2', b: 'y' },
        { a: '3', b: 'z' },
      ];
      const result = processData(input);
      expect(result.columns.find(c => c.name === 'a')?.type).toBe('number');
      expect(result.rows[0].a).toBe(1);
    });
  });

  it('returns empty structure when processData receives empty array', () => {
    const processed = processData([]);
    expect(processed).toEqual({ rows: [], columns: [] });
  });

  it('executes join with multiple keys and prefixes conflicting columns', () => {
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

  it('supports full join with non-matching rows', () => {
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

  it('processData throws when given non-array value', () => {
    expect(() => processData('not an array')).toThrow('rawData must be an array');
    expect(() => processData(null)).toThrow('rawData must be an array');
    expect(() => processData({})).toThrow('rawData must be an array');
  });

  describe('joinDatasets input validation', () => {
    it('throws when datasets are not arrays', () => {
      expect(() => joinDatasets({
        leftRows: 'not array',
        rightRows: [],
        leftKeys: ['id'],
        rightKeys: ['id'],
        leftDatasetName: 'a.csv',
        rightDatasetName: 'b.csv',
      })).toThrow('join-invalid-datasets');
    });

    it('throws when keys are missing or empty', () => {
      expect(() => joinDatasets({
        leftRows: [],
        rightRows: [],
        leftKeys: [],
        rightKeys: ['id'],
        leftDatasetName: 'a.csv',
        rightDatasetName: 'b.csv',
      })).toThrow('join-keys-required');

      expect(() => joinDatasets({
        leftRows: [],
        rightRows: [],
        leftKeys: null,
        rightKeys: ['id'],
        leftDatasetName: 'a.csv',
        rightDatasetName: 'b.csv',
      })).toThrow('join-keys-required');
    });

    it('throws when key counts do not match', () => {
      expect(() => joinDatasets({
        leftRows: [],
        rightRows: [],
        leftKeys: ['id', 'name'],
        rightKeys: ['key'],
        leftDatasetName: 'a.csv',
        rightDatasetName: 'b.csv',
      })).toThrow('join-keys-mismatch');
    });

    it('supports left join with non-matching rows', () => {
      const result = joinDatasets({
        leftRows: [{ id: '1', val: 'A' }, { id: '2', val: 'B' }],
        rightRows: [{ id: '1', score: '10' }],
        leftKeys: ['id'],
        rightKeys: ['id'],
        joinType: 'left',
        leftColumns: ['id', 'val'],
        rightColumns: ['score'],
        leftDatasetName: 'left.csv',
        rightDatasetName: 'right.csv',
      });
      expect(result.rows.length).toBe(2);
      expect(result.rows[1].score).toBeNull();
    });

    it('supports right join with non-matching rows', () => {
      const result = joinDatasets({
        leftRows: [{ id: '1', val: 'A' }],
        rightRows: [{ id: '1', score: '10' }, { id: '2', score: '20' }],
        leftKeys: ['id'],
        rightKeys: ['id'],
        joinType: 'right',
        leftColumns: ['val'],
        rightColumns: ['id', 'score'],
        leftDatasetName: 'left.csv',
        rightDatasetName: 'right.csv',
      });
      expect(result.rows.length).toBe(2);
      expect(result.rows[1].val).toBeNull();
    });

    it('falls back to inner join when type is invalid', () => {
      const result = joinDatasets({
        leftRows: [{ id: '1' }],
        rightRows: [{ id: '2' }],
        leftKeys: ['id'],
        rightKeys: ['id'],
        joinType: 'invalid',
        leftColumns: ['id'],
        rightColumns: ['id'],
        leftDatasetName: 'a.csv',
        rightDatasetName: 'b.csv',
      });
      expect(result.rows.length).toBe(0);
    });

    it('resolves name collision with numeric suffix', () => {
      const result = joinDatasets({
        leftRows: [{ id: '1', value: 'L', value2: 'extra' }],
        rightRows: [{ id: '1', value: 'R', value2: 'extra2' }],
        leftKeys: ['id'],
        rightKeys: ['id'],
        joinType: 'inner',
        leftColumns: ['value', 'value2'],
        rightColumns: ['value', 'value2'],
        leftDatasetName: 'a.csv',
        rightDatasetName: 'b.csv',
      });
      expect(result.rows.length).toBe(1);
      expect(result.outputColumns).toContain('a.value');
      expect(result.outputColumns).toContain('b.value');
      expect(result.outputColumns).toContain('a.value2');
      expect(result.outputColumns).toContain('b.value2');
    });

    it('sanitizes file-name prefix with special characters', () => {
      const result = joinDatasets({
        leftRows: [{ id: '1', val: 'A' }],
        rightRows: [{ id: '1', val: 'B' }],
        leftKeys: ['id'],
        rightKeys: ['id'],
        joinType: 'inner',
        leftColumns: ['val'],
        rightColumns: ['val'],
        leftDatasetName: 'my file (2).csv',
        rightDatasetName: '',
      });
      expect(result.rows.length).toBe(1);
      expect(result.outputColumns).toContain('my-file-2.val');
      expect(result.outputColumns).toContain('right.val');
    });
  });

  describe('parseCsv edge cases', () => {
    it('throws for CSV with only header and no rows', () => {
      expect(() => parseCsv('a,b,c\n')).toThrow('The CSV file is empty.');
    });

    it('parses CSV with blank rows, including them in the result', () => {
      const rows = parseCsv('a,b\n1,2\n\n3,4');
      expect(rows.length).toBe(3);
      expect(rows[0].a).toBe('1');
      expect(rows[2].a).toBe('3');
    });
  });

  describe('parseJson edge cases', () => {
    it('throws for empty JSON array', () => {
      expect(() => parseJson('[]')).toThrow('The JSON file is empty.');
    });

    it('throws for nested object with empty array', () => {
      expect(() => parseJson('{"items":[]}')).toThrow('The data array in the JSON is empty.');
    });
  });

  describe('parseJson dangerous-key stripping', () => {
    it('strips __proto__ at the top level of each row', () => {
      const result = parseJson('[{"a":1,"__proto__":"polluted"}]');
      expect(result).toEqual([{ a: 1 }]);
      expect(Object.prototype.hasOwnProperty.call(result[0], '__proto__')).toBe(false);
      expect({}.polluted).toBeUndefined();
    });

    it('strips constructor and prototype keys', () => {
      const result = parseJson('[{"name":"x","constructor":"y","prototype":"z"}]');
      expect(result).toEqual([{ name: 'x' }]);
    });

    it('strips dangerous keys at nested depth', () => {
      const result = parseJson('[{"a":{"__proto__":"polluted","b":1}}]');
      expect(result).toEqual([{ a: { b: 1 } }]);
    });

    it('strips dangerous keys inside nested arrays', () => {
      const result = parseJson('[{"items":[{"__proto__":"polluted","ok":true}]}]');
      expect(result).toEqual([{ items: [{ ok: true }] }]);
    });

    it('strips dangerous keys from the nested-array root form', () => {
      const result = parseJson('{"rows":[{"__proto__":"polluted","x":1}]}');
      expect(result).toEqual([{ x: 1 }]);
    });

    it('preserves null, primitives, and keys with similar-but-different names', () => {
      const result = parseJson('[{"a":null,"b":0,"c":"","__proto__":"x","_proto_":"keep"}]');
      expect(result).toEqual([{ a: null, b: 0, c: '', _proto_: 'keep' }]);
    });
  });

  describe('detectType edge cases', () => {
    it('returns text as fallback for empty values', () => {
      expect(detectType([null, undefined, ''])).toBe('text');
      expect(detectType([])).toBe('text');
    });

    it('detects dates when most values are valid dates', () => {
      expect(detectType(['2024-01-01', '2024-06-15', '2024-12-31'])).toBe('date');
    });

    it('detects numbers with European decimal separator', () => {
      expect(detectType(['3,14', '2,71', '1,41'], ',')).toBe('number');
    });
  });

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
  });

  it('formats file sizes in B, KB, and MB', () => {
    expect(formatFileSize(100)).toBe('100 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });

  it('detects correct delimiter from the first line', () => {
    expect(detectDelimiter('a,b,c')).toBe(',');
    expect(detectDelimiter('a;b;c')).toBe(';');
    expect(detectDelimiter('a\tb\tc')).toBe('\t');
    expect(detectDelimiter('a|b|c')).toBe('|');
    expect(detectDelimiter('')).toBe(','); // fallback
    expect(detectDelimiter('nenhum_delimitador')).toBe(','); // fallback
  });

  it('detects tiebreaker: prefers comma when counts are equal', () => {
    // one comma and one semicolon, comma has priority
    expect(detectDelimiter('a,b;c')).toBe(',');
  });

  it('parses TSV with delimiter auto-detection', () => {
    const rows = parseCsv('a\tb\n1\t2\n3\t4');
    expect(rows.length).toBe(2);
    expect(rows[0].a).toBe('1');
    expect(rows[0].b).toBe('2');
  });

  it('parses semicolon-delimited file with auto-detection', () => {
    const rows = parseCsv('a;b\n1;2\n3;4');
    expect(rows.length).toBe(2);
    expect(rows[0].a).toBe('1');
  });

  it('parses pipe-delimited file with auto-detection', () => {
    const rows = parseCsv('a|b\n1|2\n3|4');
    expect(rows.length).toBe(2);
    expect(rows[0].a).toBe('1');
  });
});
