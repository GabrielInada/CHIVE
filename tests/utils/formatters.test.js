// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { escapeHtml, formatFileSize, formatNumber } from '../../src/utils/formatters.js';

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
});
