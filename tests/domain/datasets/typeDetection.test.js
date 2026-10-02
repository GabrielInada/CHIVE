import { describe, expect, it } from 'vitest';
import {
  detectType,
  detectDecimalSeparator,
  normalizeNumericString,
} from '../../../src/domain/datasets/typeDetection.js';

describe('typeDetection', () => {
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

    it('Stage 2: a single separator after a 4+ digit leading group is decimal', () => {
      // Survey coordinates with millimetre precision: every value has exactly 3
      // decimals, so the small elevation used to win Stage 2b and read the
      // whole file as comma-decimal.
      expect(detectDecimalSeparator(['784431.551', '9839149.107', '6.358'])).toBe('.');
      expect(detectDecimalSeparator(['784431,551', '9839149,107', '6,358'])).toBe(',');
      expect(detectDecimalSeparator(['-1234.567', '6.358'])).toBe('.');
    });

		it.each([
			['6.358', '7.045'],
			['-6.358', '-7.045'],
			['6.000', '7.045'],
			['1.125', '99.375', '999.875'],
		])('defaults ambiguous three-decimal measurements to dot: %j', (...values) => {
			expect(detectDecimalSeparator(values)).toBe('.');
		});

		it.each([
			['01.358', '1.234,56'],
			['-01.358', '-1.234,56'],
			['001.358', '1.234,56'],
		])('does not treat a zero-padded integer as a zero group: %j', (...values) => {
			expect(detectDecimalSeparator(values)).toBe(',');
		});

		it('uses typed fractions only when strings have no clear decimal convention', () => {
			expect(detectDecimalSeparator([2.5, '1.250'])).toBe('.');
			expect(detectDecimalSeparator([2.5, '1.000'])).toBe('.');
			expect(detectDecimalSeparator([2.5, '1.234,56'])).toBe(',');
			expect(detectDecimalSeparator([2.5, 3.75, '1,25'])).toBe(',');
			expect(detectDecimalSeparator([2, '1.000'])).toBe(',');
		});

		it('recognizes repeated thousands groups even without decimal digits', () => {
			expect(detectDecimalSeparator(['1.234.567', '-2.345.678'])).toBe(',');
			expect(detectDecimalSeparator(['1,234,567', '-2,345,678'])).toBe('.');
		});

    it('Stage 2: a single zero group is decimal, never thousands', () => {
      expect(detectDecimalSeparator(['0.125', '0.375'])).toBe('.');
      expect(detectDecimalSeparator(['0,125', '0,375'])).toBe(',');
    });

    it('Stage 2: thousands-grouped values keep their old reading', () => {
      expect(detectDecimalSeparator(['1.000', '12.500', '1.250.000'])).toBe(',');
      expect(detectDecimalSeparator(['1,250,000', '3.5'])).toBe('.');
    });

    it('Stage 3: NaN fallback, reverts when detected separator produces many NaN', () => {
      // All values have exactly 3 decimal places in European format.
      // Stages 1-2b skip them as ambiguous, fall back to '.',
      // but Stage 3 sees high NaN rate and switches to ','.
      const values = ['3,141', '2,718', '1,414', '1,732'];
      expect(detectDecimalSeparator(values)).toBe(',');
    });

    it('dot wins ties as the higher-priority separator', () => {
      // Equal evidence for both: dot wins
      expect(detectDecimalSeparator(['3.14', '3,14'])).toBe('.');
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
});
