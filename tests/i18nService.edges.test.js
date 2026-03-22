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

vi.mock('banana-i18n', () => ({
	default: mocks.MockBanana,
}));

vi.mock('../src/i18n/pt-BR.json', () => ({ default: {} }));
vi.mock('../src/i18n/en.json', () => ({ default: {} }));

import { t, obterLocale, definirLocale, inicializarI18n } from '../src/services/i18nService.js';

/**
 * Edge case tests for i18nService covering low-branching scenarios.
 */
describe('i18nService branching coverage', () => {
	beforeEach(() => {
		document.body.innerHTML = `
			<html>
				<select id="select-lang"><option value="pt-BR">PT</option><option value="en">EN</option></select>
				<div id="lang-display">Português</div>
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

	describe('inicializarI18n() branches', () => {
		it('loads saved locale if valid', () => {
			localStorage.setItem('chive-locale', 'en');
			mocks.mockBanana.locale = 'en';
			inicializarI18n();
			expect(mocks.mockBanana.setLocale).toHaveBeenCalledWith('en');
		});

		it('defaults to pt-BR on invalid saved locale', () => {
			localStorage.setItem('chive-locale', 'xx-YY');
			inicializarI18n();
			expect(mocks.mockBanana.setLocale).toHaveBeenCalledWith('pt-BR');
		});

		it('handles missing select-lang element', () => {
			document.getElementById('select-lang')?.remove();
			expect(() => inicializarI18n()).not.toThrow();
		});

		it('handles missing lang-display element', () => {
			document.getElementById('lang-display')?.remove();
			expect(() => inicializarI18n()).not.toThrow();
		});

		it('sets correct language label for each locale', () => {
			mocks.mockBanana.locale = 'pt-BR';
			inicializarI18n();
			expect(document.getElementById('lang-display').textContent).toBe('Português');
		});
	});

	describe('definirLocale() branches', () => {
		it('rejects invalid locale without side effects', () => {
			definirLocale('invalid');
			expect(mocks.mockBanana.setLocale).not.toHaveBeenCalled();
			expect(localStorage.getItem('chive-locale')).toBeNull();
		});

		it('accepts valid locale and emits event', () => {
			const spy = vi.fn();
			window.addEventListener('chive-locale-changed', spy);
			definirLocale('en');
			expect(spy).toHaveBeenCalledWith(expect.objectContaining({ detail: { locale: 'en' } }));
			window.removeEventListener('chive-locale-changed', spy);
		});

		it('sets document.documentElement.lang attribute', () => {
			definirLocale('en');
			expect(document.documentElement.lang).toBe('en');
		});
	});

	describe('Page translation branches', () => {
		it('handles [data-i18n] attributes', () => {
			definirLocale('en');
			const btn = document.querySelector('[data-i18n="btn-test"]');
			expect(btn.textContent).toBe('text:btn-test');
		});

		it('updates aria-label when present in [data-i18n-title]', () => {
			definirLocale('en');
			const btn = document.querySelector('[data-i18n-title]');
			expect(btn.getAttribute('aria-label')).toBe('text:title-test');
		});

		it('sets title attribute from [data-i18n-title]', () => {
			definirLocale('en');
			const btn = document.querySelector('[data-i18n-title]');
			expect(btn.title).toBe('text:title-test');
		});

		it('updates document.title', () => {
			definirLocale('en');
			expect(document.title).toBe('text:chive-page-title');
		});
	});

	describe('t() function', () => {
		it('passes key and params to banana.i18n', () => {
			t('key-test', 'p1', 'p2');
			expect(mocks.mockBanana.i18n).toHaveBeenCalledWith('key-test', 'p1', 'p2');
		});
	});

	describe('obterLocale() function', () => {
		it('returns current locale from banana', () => {
			mocks.mockBanana.locale = 'pt-BR';
			expect(obterLocale()).toBe('pt-BR');
			mocks.mockBanana.locale = 'en';
			expect(obterLocale()).toBe('en');
		});
	});
});
