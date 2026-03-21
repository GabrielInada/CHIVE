// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { definirLocale, obterLocale, t } from '../src/services/i18nService.js';

describe('i18n locale updates', () => {
  beforeEach(() => {
    document.documentElement.lang = 'pt-BR';
    localStorage.clear();
  });

  it('updates html lang and localStorage when locale changes', () => {
    definirLocale('en');

    expect(obterLocale()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('chive-locale')).toBe('en');
    expect(t('chive-no-files')).toBe('No files');
  });

  it('dispatches chive-locale-changed event', () => {
    const listener = vi.fn();
    window.addEventListener('chive-locale-changed', listener);

    definirLocale('en');

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('chive-locale-changed', listener);
  });
});
