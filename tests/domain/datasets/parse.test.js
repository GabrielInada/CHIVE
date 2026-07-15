import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseCsv, parseJson } from '../../../src/domain/datasets/parse.js';

describe('parse', () => {
  it('parses CSV and fails on empty CSV', () => {
    const parsed = parseCsv('a,b\n1,2\n3,4');
    expect(parsed.ok).toBe(true);
    expect(parsed.rows.length).toBe(2);
    expect(parsed.rows[0].a).toBe('1');

    const empty = parseCsv('');
    expect(empty.ok).toBe(false);
    expect(empty.reason).toBe('csv-empty');
  });

  it('parses JSON in supported formats and fails on invalid', () => {
    const arr = parseJson('[{"a":1},{"a":2}]');
    expect(arr.ok).toBe(true);
    expect(arr.rows.length).toBe(2);

    const nested = parseJson('{"items":[{"x":1}]}');
    expect(nested.ok).toBe(true);
    expect(nested.rows.length).toBe(1);

    const syntax = parseJson('{');
    expect(syntax.ok).toBe(false);
    expect(syntax.reason).toBe('json-syntax');

    const unrecognized = parseJson('{"foo":1}');
    expect(unrecognized.ok).toBe(false);
    expect(unrecognized.reason).toBe('json-unrecognized');
  });

  describe('parseCsv edge cases', () => {
    it('fails for CSV with only header and no rows', () => {
      const r = parseCsv('a,b,c\n');
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('csv-empty');
    });

    it('parses CSV with blank rows, including them in the result', () => {
      const parsed = parseCsv('a,b\n1,2\n\n3,4');
      expect(parsed.ok).toBe(true);
      expect(parsed.rows.length).toBe(3);
      expect(parsed.rows[0].a).toBe('1');
      expect(parsed.rows[2].a).toBe('3');
    });
  });

  describe('parseJson edge cases', () => {
    it('fails for empty JSON array', () => {
      const r = parseJson('[]');
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('json-empty');
    });

    it('fails for nested object with empty array', () => {
      const r = parseJson('{"items":[]}');
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('json-array-empty');
    });
  });

  describe('parseJson dangerous-key stripping', () => {
    it('strips __proto__ at the top level of each row', () => {
      const result = parseJson('[{"a":1,"__proto__":"polluted"}]');
      expect(result.ok).toBe(true);
      expect(result.rows).toEqual([{ a: 1 }]);
      expect(Object.prototype.hasOwnProperty.call(result.rows[0], '__proto__')).toBe(false);
      expect({}.polluted).toBeUndefined();
    });

    it('strips constructor and prototype keys', () => {
      const result = parseJson('[{"name":"x","constructor":"y","prototype":"z"}]');
      expect(result.ok).toBe(true);
      expect(result.rows).toEqual([{ name: 'x' }]);
    });

    it('strips dangerous keys at nested depth', () => {
      const result = parseJson('[{"a":{"__proto__":"polluted","b":1}}]');
      expect(result.ok).toBe(true);
      expect(result.rows).toEqual([{ a: { b: 1 } }]);
    });

    it('strips dangerous keys inside nested arrays', () => {
      const result = parseJson('[{"items":[{"__proto__":"polluted","ok":true}]}]');
      expect(result.ok).toBe(true);
      expect(result.rows).toEqual([{ items: [{ ok: true }] }]);
    });

    it('strips dangerous keys from the nested-array root form', () => {
      const result = parseJson('{"rows":[{"__proto__":"polluted","x":1}]}');
      expect(result.ok).toBe(true);
      expect(result.rows).toEqual([{ x: 1 }]);
    });

    it('preserves null, primitives, and keys with similar-but-different names', () => {
      const result = parseJson('[{"a":null,"b":0,"c":"","__proto__":"x","_proto_":"keep"}]');
      expect(result.ok).toBe(true);
      expect(result.rows).toEqual([{ a: null, b: 0, c: '', _proto_: 'keep' }]);
    });
  });

  describe('detectDelimiter', () => {
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
      const parsed = parseCsv('a\tb\n1\t2\n3\t4');
      expect(parsed.ok).toBe(true);
      expect(parsed.rows.length).toBe(2);
      expect(parsed.rows[0].a).toBe('1');
      expect(parsed.rows[0].b).toBe('2');
    });

    it('parses semicolon-delimited file with auto-detection', () => {
      const parsed = parseCsv('a;b\n1;2\n3;4');
      expect(parsed.ok).toBe(true);
      expect(parsed.rows.length).toBe(2);
      expect(parsed.rows[0].a).toBe('1');
    });

    it('parses pipe-delimited file with auto-detection', () => {
      const parsed = parseCsv('a|b\n1|2\n3|4');
      expect(parsed.ok).toBe(true);
      expect(parsed.rows.length).toBe(2);
      expect(parsed.rows[0].a).toBe('1');
    });
  });
});
