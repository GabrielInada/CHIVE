// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { escapeHtml, formatNumber } from '../../src/utils/formatters.js';

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
});
