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

	it.each([
		{
			name: 'three-decimal measurements without larger coordinates',
			values: ['6.358', '7.045'],
			expected: [6.358, 7.045],
		},
		{
			name: 'zero-padded thousands with explicit European decimals',
			values: ['01.358', '1.234,56'],
			expected: [1358, 1234.56],
		},
		{
			name: 'mixed typed numbers and dot-decimal strings',
			values: [2.5, '1.250'],
			expected: [2.5, 1.25],
		},
		{
			name: 'whole-number decimal strings alongside typed fractions',
			values: [2.5, '1.000'],
			expected: [2.5, 1],
		},
		{
			name: 'whole-number measurements without explicit decimal evidence',
			values: ['6.000', '7.045'],
			expected: [6, 7.045],
		},
		{
			name: 'European decimal strings alongside typed fractions',
			values: [2.5, 3.75, '1.234,56'],
			expected: [2.5, 3.75, 1234.56],
		},
		{
			name: 'whole-number measurements with explicit dot-decimal evidence',
			values: ['6.000', '7.045', '8.25'],
			expected: [6, 7.045, 8.25],
		},
		{
			name: 'explicit thousands grouping alongside ambiguous values',
			values: ['1.234.567', '01.358', '12.500'],
			expected: [1234567, 1358, 12500],
		},
	])('preserves $name', ({ values, expected }) => {
		const result = processData(values.map(v => ({ v })));
		expect(result.columns.find(c => c.name === 'v')?.type).toBe('number');
		expect(result.rows.map(row => row.v)).toEqual(expected);
	});

  describe('processData with European decimal separator', () => {
		it('preserves ambiguous grouped integers with an explicit comma separator', () => {
			const parsed = parseCsv('population\n1.000\n1.234\n2.345\n');
			expect(parsed.ok).toBe(true);
			const result = processData(parsed.rows, { decimalSeparator: ',' });
			expect(result.rows.map(row => row.population)).toEqual([1000, 1234, 2345]);
		});

		it.each([
			{ decimalSeparator: 'auto', population: 1 },
			{ decimalSeparator: '.', population: 1 },
			{ decimalSeparator: ',', population: 1000 },
		])('keeps typed fractions independent of $decimalSeparator string formatting', ({ decimalSeparator, population }) => {
			const result = processData([{ rate: 2.5, population: '1.000' }], { decimalSeparator });
			expect(result.rows).toEqual([{ rate: 2.5, population }]);
		});

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

    it('converts ambiguous European integers with an explicit comma separator', () => {
      const input = [
        { populacao: '1.000', pais: 'A' },
        { populacao: '50.000', pais: 'B' },
        { populacao: '2.000', pais: 'C' },
      ];
      const result = processData(input, { decimalSeparator: ',' });
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

    it('keeps dot-decimal values with exactly 3 decimals exact', () => {
      const input = [
        { x: '784431.551', z: '6.358' },
        { x: '784411.896', z: '7.045' },
      ];
      const result = processData(input);
      expect(result.rows[0].x).toBeCloseTo(784431.551, 3);
      expect(result.rows[0].z).toBeCloseTo(6.358, 3);
    });

    it('keeps already-typed numbers instead of re-reading their text', () => {
      const result = processData([{ v: 1.125 }, { v: 2.25 }, { v: 3.375 }]);
      expect(result.columns.find(c => c.name === 'v')?.type).toBe('number');
      expect(result.rows.map(row => row.v)).toEqual([1.125, 2.25, 3.375]);
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
