// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	const mockBanana = {
		locale: 'pt-BR',
		i18n: vi.fn((key) => `translated:${key}`),
		setLocale: vi.fn(),
		load: vi.fn(),
	};

	class MockBanana {
		constructor() {
			return mockBanana;
		}
	}

	return { mockBanana, MockBanana };
});

vi.mock('../../vendor/banana-i18n/banana-i18n.js', () => ({
	default: mocks.MockBanana,
}));

vi.mock('../../src/i18n/pt-BR.json', () => ({ default: {} }));
vi.mock('../../src/i18n/en.json', () => ({ default: {} }));

import { t, getLocale, setLocale, initializeI18n } from '../../src/services/i18nService.js';

/**
 * Edge case tests for i18nService covering low-branching scenarios.
 */
describe('i18nService branching coverage', () => {
	beforeEach(() => {
		document.body.innerHTML = `
			<html>
				<button data-i18n="btn-test" data-i18n-title="title-test" aria-label="old"></button>
				<div data-i18n-html="html-test"></div>
			</html>
		`;
		localStorage.clear();
		mocks.mockBanana.setLocale.mockClear();
		mocks.mockBanana.i18n.mockClear();
		mocks.mockBanana.i18n.mockImplementation((key) => `text:${key}`);
		mocks.mockBanana.locale = 'pt-BR';
	});

	describe('initializeI18n() branches', () => {
		it('loads saved locale if valid', async () => {
			localStorage.setItem('chive-locale', 'en');
			mocks.mockBanana.locale = 'en';
			await initializeI18n();
			expect(mocks.mockBanana.setLocale).toHaveBeenCalledWith('en');
		});

		it('defaults to pt-BR on invalid saved locale', async () => {
			localStorage.setItem('chive-locale', 'xx-YY');
			await initializeI18n();
			expect(mocks.mockBanana.setLocale).toHaveBeenCalledWith('pt-BR');
		});

		it('leaves page-shell visibility to the startup lifecycle', async () => {
			document.body.style.visibility = 'hidden';
			await initializeI18n();
			expect(document.body.style.visibility).toBe('hidden');
		});
	});

	describe('setLocale() branches', () => {
		it('rejects invalid locale without side effects', async () => {
			await expect(setLocale('invalid')).resolves.toEqual({
				ok: false,
				reason: 'unsupported-locale',
			});
			expect(mocks.mockBanana.setLocale).not.toHaveBeenCalled();
			expect(localStorage.getItem('chive-locale')).toBeNull();
		});

		it('accepts valid locale and emits event', async () => {
			const spy = vi.fn();
			window.addEventListener('chive-locale-changed', spy);
			await setLocale('en');
			expect(spy).toHaveBeenCalledWith(expect.objectContaining({ detail: { locale: 'en' } }));
			window.removeEventListener('chive-locale-changed', spy);
		});

		it('sets document.documentElement.lang attribute', async () => {
			await setLocale('en');
			expect(document.documentElement.lang).toBe('en');
		});
	});

	describe('Page translation branches', () => {
		it('handles [data-i18n] attributes', async () => {
			await setLocale('en');
			const btn = document.querySelector('[data-i18n="btn-test"]');
			expect(btn.textContent).toBe('text:btn-test');
		});

		it('updates aria-label when present in [data-i18n-title]', async () => {
			await setLocale('en');
			const btn = document.querySelector('[data-i18n-title]');
			expect(btn.getAttribute('aria-label')).toBe('text:title-test');
		});

		it('sets title attribute from [data-i18n-title]', async () => {
			await setLocale('en');
			const btn = document.querySelector('[data-i18n-title]');
			expect(btn.title).toBe('text:title-test');
		});

		it('updates document.title', async () => {
			await setLocale('en');
			expect(document.title).toBe('text:chive-page-title');
		});
	});

	describe('t() function', () => {
		it('passes key and params to banana.i18n', () => {
			t('key-test', 'p1', 'p2');
			expect(mocks.mockBanana.i18n).toHaveBeenCalledWith('key-test', 'p1', 'p2');
		});
	});

	describe('getLocale() function', () => {
		it('returns current locale from banana', () => {
			mocks.mockBanana.locale = 'pt-BR';
			expect(getLocale()).toBe('pt-BR');
			mocks.mockBanana.locale = 'en';
			expect(getLocale()).toBe('en');
		});
	});
});
