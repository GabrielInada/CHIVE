// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { escaparHTML, formatarNumero } from '../src/utils/formatters.js';

describe('formatters', () => {
  it('escapa caracteres HTML sensiveis', () => {
    const value = `<div class="x">O'Reilly & Co</div>`;
    expect(escaparHTML(value)).toBe('&lt;div class=&quot;x&quot;&gt;O&#39;Reilly &amp; Co&lt;/div&gt;');
  });

  it('formata numeros com regras de precisao', () => {
    expect(formatarNumero(null, 'en-US')).toBe('—');
    expect(formatarNumero('', 'en-US')).toBe('—');
    expect(formatarNumero('foo', 'en-US')).toBe('—');

    expect(formatarNumero(1234, 'en-US')).toBe('1,234');
    expect(formatarNumero(123.45, 'en-US')).toBe('123.5');
    expect(formatarNumero(12.3456, 'en-US')).toBe('12.35');

    // Small values use toPrecision(4)
    expect(formatarNumero(0.012345, 'en-US')).toBe('0.01235');
  });
});
