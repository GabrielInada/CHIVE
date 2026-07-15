import { describe, expect, it } from 'vitest';
import { processData } from '../../../src/domain/datasets/processData.js';
import { calculateStatistics } from '../../../src/domain/datasets/statistics.js';
import { parseCsv } from '../../../src/domain/datasets/parse.js';

describe('processData', () => {
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
      const parsed = parseCsv(csv);
      expect(parsed.ok).toBe(true);
      const result = processData(parsed.rows);
      expect(result.columns.find(c => c.name === 'value')?.type).toBe('number');
      expect(result.rows[0].value).toBeCloseTo(1234.56);
      expect(result.rows[1].value).toBeCloseTo(2345.67);
    });

    it('converts European format end-to-end with semicolon delimiter', () => {
      const csv = 'id;valor\n1;3,14\n2;2,71\n3;1,41';
      const parsed = parseCsv(csv);
      expect(parsed.ok).toBe(true);
      const result = processData(parsed.rows);
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
      const parsed = parseCsv(csv);
      expect(parsed.ok).toBe(true);
      const result = processData(parsed.rows);
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

  it('processData throws when given non-array value', () => {
    expect(() => processData('not an array')).toThrow('rawData must be an array');
    expect(() => processData(null)).toThrow('rawData must be an array');
    expect(() => processData({})).toThrow('rawData must be an array');
  });
});
