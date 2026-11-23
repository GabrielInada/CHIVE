// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	const mockBanana = {
		locale: 'pt-BR',
		i18n: vi.fn(key => `text:${key}`),
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

vi.mock('../../vendor/banana-i18n/banana-i18n.js', () => ({ default: mocks.MockBanana }));

/**
 * Stub `fetch` so each catalog request stays pending until the test settles
 * it, which lets a test choose the order in which racing requests finish.
 */
function stubDeferredCatalogs() {
	const pending = new Map();
	const fetchCatalog = vi.fn(url => new Promise(resolve => {
		const locale = String(url).match(/i18n\/([^/]+)\.json$/)[1];
		pending.set(locale, () => resolve(new Response(JSON.stringify({ [`${locale}-key`]: locale }))));
	}));
	vi.stubGlobal('fetch', fetchCatalog);
	return {
		fetchCatalog,
		async settle(locale) {
			pending.get(locale)();
			// Let the response body and the awaiting caller resume.
			await new Promise(resolve => setTimeout(resolve, 0));
		},
	};
}

async function loadFreshService() {
	vi.resetModules();
	return import('../../src/services/i18nService.js');
}

describe('i18nService request ordering', () => {
	beforeEach(() => {
		localStorage.clear();
		document.body.innerHTML = '';
		mocks.mockBanana.setLocale.mockClear();
		mocks.mockBanana.load.mockClear();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('lets the newest setLocale win when an older catalog arrives last', async () => {
		const catalogs = stubDeferredCatalogs();
		const i18n = await loadFreshService();
		const changed = vi.fn();
		window.addEventListener('chive-locale-changed', changed);

		const older = i18n.setLocale('en');
		const newer = i18n.setLocale('pt-BR');
		await catalogs.settle('pt-BR');
		await catalogs.settle('en');

		await expect(newer).resolves.toEqual({ ok: true, locale: 'pt-BR' });
		await expect(older).resolves.toEqual({ ok: false, reason: 'superseded' });
		expect(mocks.mockBanana.setLocale.mock.calls).toEqual([['pt-BR']]);
		expect(localStorage.getItem('chive-locale')).toBe('pt-BR');
		expect(document.documentElement.lang).toBe('pt-BR');
		expect(changed).toHaveBeenCalledTimes(1);
		window.removeEventListener('chive-locale-changed', changed);
	});

	it('drops a slow startup load once the user has picked a locale', async () => {
		localStorage.setItem('chive-locale', 'en');
		const catalogs = stubDeferredCatalogs();
		const i18n = await loadFreshService();

		const startup = i18n.initializeI18n();
		const picked = i18n.setLocale('pt-BR');
		await catalogs.settle('pt-BR');
		await catalogs.settle('en');
		await startup;

		await expect(picked).resolves.toEqual({ ok: true, locale: 'pt-BR' });
		expect(mocks.mockBanana.setLocale.mock.calls).toEqual([['pt-BR']]);
		expect(mocks.mockBanana.load).not.toHaveBeenCalledWith(expect.anything(), 'en');
	});

	it('fetches and loads each catalog once across repeated requests', async () => {
		const catalogs = stubDeferredCatalogs();
		const i18n = await loadFreshService();

		const first = i18n.setLocale('en');
		const second = i18n.setLocale('en');
		await catalogs.settle('en');
		await expect(first).resolves.toEqual({ ok: false, reason: 'superseded' });
		await expect(second).resolves.toEqual({ ok: true, locale: 'en' });
		await expect(i18n.setLocale('en')).resolves.toEqual({ ok: true, locale: 'en' });

		expect(catalogs.fetchCatalog).toHaveBeenCalledTimes(1);
		expect(mocks.mockBanana.load).toHaveBeenCalledTimes(1);
		expect(mocks.mockBanana.setLocale).toHaveBeenCalledTimes(2);
	});

	it('reports blocked storage without switching the active locale', async () => {
		const i18n = await loadFreshService();
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new DOMException('blocked', 'SecurityError');
		});
		const changed = vi.fn();
		window.addEventListener('chive-locale-changed', changed);

		await expect(i18n.setLocale('en')).resolves.toEqual({ ok: false, reason: 'storage-unavailable' });

		expect(mocks.mockBanana.setLocale).not.toHaveBeenCalled();
		expect(changed).not.toHaveBeenCalled();
		window.removeEventListener('chive-locale-changed', changed);
	});

	it('starts in the default locale when storage cannot be read', async () => {
		const i18n = await loadFreshService();
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new DOMException('blocked', 'SecurityError');
		});

		await i18n.initializeI18n();

		expect(mocks.mockBanana.setLocale).toHaveBeenCalledWith('pt-BR');
	});
});

describe('i18nService static page translation', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('renders markup only for elements that opt in with data-i18n-html', async () => {
		mocks.mockBanana.i18n.mockImplementation(key => `<b>${key}</b>`);
		document.body.innerHTML = `
			<p id="plain" data-i18n="plain-key"></p>
			<p id="rich" data-i18n="rich-key" data-i18n-html></p>
		`;
		const i18n = await loadFreshService();

		await i18n.setLocale('en');

		expect(document.getElementById('plain').textContent).toBe('<b>plain-key</b>');
		expect(document.getElementById('plain').children).toHaveLength(0);
		expect(document.getElementById('rich').innerHTML).toBe('<b>rich-key</b>');
	});

	it('translates close-button labels and leaves aria-label alone when absent', async () => {
		mocks.mockBanana.i18n.mockImplementation(key => `text:${key}`);
		document.body.innerHTML = `
			<dialog id="dlg" data-i18n-close-label="close-key"></dialog>
			<button id="btn" data-i18n-title="title-key"></button>
		`;
		const i18n = await loadFreshService();

		await i18n.setLocale('en');

		expect(document.getElementById('dlg').dataset.closeLabel).toBe('text:close-key');
		expect(document.getElementById('btn').title).toBe('text:title-key');
		expect(document.getElementById('btn').hasAttribute('aria-label')).toBe(false);
	});
});

describe('translateType', () => {
	it('translates the known column types and passes others through', async () => {
		mocks.mockBanana.i18n.mockImplementation(key => `text:${key}`);
		const { translateType } = await loadFreshService();

		expect(translateType('number')).toBe('text:chive-type-number');
		expect(translateType('text')).toBe('text:chive-type-text');
		expect(translateType('date')).toBe('text:chive-type-date');
		expect(translateType('currency')).toBe('currency');
	});
});
