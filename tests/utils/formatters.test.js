// @vitest-environment jsdom

import process from 'node:process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { escapeHtml, formatDate, formatFileSize, formatNumber, toFiniteNumber } from '../../src/utils/formatters.js';

describe('formatters', () => {
  it('escapes sensitive HTML characters', () => {
    const value = `<div class="x">O'Reilly & Co</div>`;
    expect(escapeHtml(value)).toBe('&lt;div class=&quot;x&quot;&gt;O&#39;Reilly &amp; Co&lt;/div&gt;');
  });

  it('formats numbers with precision rules', () => {
    expect(formatNumber(null, 'en-US')).toBe('N/A');
    expect(formatNumber('', 'en-US')).toBe('N/A');
    expect(formatNumber('foo', 'en-US')).toBe('N/A');

    expect(formatNumber(1234, 'en-US')).toBe('1,234');
    expect(formatNumber(123.45, 'en-US')).toBe('123.5');
    expect(formatNumber(12.3456, 'en-US')).toBe('12.35');

    // Small values use toPrecision(4)
    expect(formatNumber(0.012345, 'en-US')).toBe('0.01235');
  });

  it('formats file sizes in B, KB, and MB', () => {
    expect(formatFileSize(100)).toBe('100 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });

  // Either side of UTC: local formatting shows the day before west of it and
  // the day after east of it.
  describe.each(['America/Sao_Paulo', 'Asia/Tokyo'])('formatDate in %s', zone => {
    let previous;
    beforeAll(() => {
      previous = process.env.TZ;
      process.env.TZ = zone;
    });
    afterAll(() => {
      process.env.TZ = previous;
    });

    it.each([
      ['a date-only cell', '2024-01-01', 'Jan 01, 2024'],
      ['a date-time cell late in its day', '2024-01-15T23:30:00.000Z', 'Jan 15, 2024'],
      ['a date-time cell early in its day', '2024-01-15T00:30:00.000Z', 'Jan 15, 2024'],
      ['a Date', new Date('2024-01-15T00:00:00.000Z'), 'Jan 15, 2024'],
    ])('reads %s in UTC', (_label, value, expected) => {
      expect(formatDate(value, 'en-US')).toBe(expected);
    });

    it('formats the time of day in UTC whatever zone the caller asks for', () => {
      const options = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Tokyo' };
      expect(formatDate('2024-01-15T10:30:00.000Z', 'en-US', options)).toBe('10:30');
    });
  });

  it.each([null, undefined, '', 'not a date'])('formats %o as an empty string', value => {
    expect(formatDate(value, 'en-US')).toBe('');
  });

  describe('toFiniteNumber', () => {
    it('parses numbers and numeric strings', () => {
      expect(toFiniteNumber(42)).toBe(42);
      expect(toFiniteNumber('42')).toBe(42);
      expect(toFiniteNumber('784431.551')).toBe(784431.551);
      expect(toFiniteNumber(' 7 ')).toBe(7);
      expect(toFiniteNumber('-3.5')).toBe(-3.5);
    });

    it('keeps genuine zeros, which are data and not absence', () => {
      expect(toFiniteNumber(0)).toBe(0);
      expect(toFiniteNumber('0')).toBe(0);
      expect(Object.is(toFiniteNumber(-0), -0)).toBe(true);
    });

    it.each([
      ['empty string', ''],
      ['whitespace', '   '],
      ['null', null],
      ['undefined', undefined],
      ['non-numeric text', 'abc'],
      ['Infinity', Infinity],
      ['-Infinity', -Infinity],
      ['NaN', NaN],
    ])('returns NaN for %s', (_label, value) => {
      expect(toFiniteNumber(value)).toBeNaN();
    });

    it('does not repeat the Number() coercions that invented zeros', () => {
      // These are exactly the cases that turned a blank survey cell into a
      // point at the origin.
      expect(Number('')).toBe(0);
      expect(Number(null)).toBe(0);
      expect(toFiniteNumber('')).toBeNaN();
      expect(toFiniteNumber(null)).toBeNaN();
    });
  });
});
