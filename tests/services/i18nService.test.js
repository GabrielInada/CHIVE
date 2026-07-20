// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18n, setLocale, getLocale, t } from '../../src/services/i18nService.js';

describe('i18n locale updates', () => {
  beforeEach(async () => {
    document.documentElement.lang = 'pt-BR';
    localStorage.clear();
    await initializeI18n();
  });

  it('updates html lang and localStorage when locale changes', async () => {
    const result = await setLocale('en');

    expect(result).toEqual({ ok: true, locale: 'en' });
    expect(getLocale()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('chive-locale')).toBe('en');
    expect(t('chive-no-files')).toBe('No files');
  });

  it('dispatches chive-locale-changed event', async () => {
    const listener = vi.fn();
    window.addEventListener('chive-locale-changed', listener);

    await setLocale('en');

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('chive-locale-changed', listener);
  });
});
