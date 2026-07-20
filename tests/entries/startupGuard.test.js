// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function mountGuardDom() {
	document.body.innerHTML = `
		<div id="startup-screen" role="status">
			<p
				id="startup-message"
				data-loading-en="Loading"
				data-loading-pt="Carregando"
				data-slow-en="Slow"
				data-slow-pt="Lento"
				data-error-en="Failed"
				data-error-pt="Falhou"
			></p>
			<button id="startup-reload" data-label-en="Reload" data-label-pt="Recarregar" hidden></button>
		</div>
	`;
}

describe('dependency-free startup guard', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.resetModules();
		localStorage.clear();
		delete window.chiveStartupGuard;
		mountGuardDom();
	});

	afterEach(() => {
		window.chiveStartupGuard?.complete();
		vi.useRealTimers();
	});

	it('selects the saved copy and exposes recovery after ten seconds', async () => {
		localStorage.setItem('chive-locale', 'en');
		await import('../../src/entries/startupGuard.js');

		expect(document.getElementById('startup-message').textContent).toBe('Loading');
		expect(document.getElementById('startup-reload').textContent).toBe('Reload');

		vi.advanceTimersByTime(10000);
		expect(document.getElementById('startup-message').textContent).toBe('Slow');
		expect(document.getElementById('startup-reload').hidden).toBe(false);
	});

	it('shows the static localized failure when modules cannot provide a message', async () => {
		localStorage.setItem('chive-locale', 'pt-BR');
		await import('../../src/entries/startupGuard.js');

		window.chiveStartupGuard.fail();

		expect(document.getElementById('startup-message').textContent).toBe('Falhou');
		expect(document.getElementById('startup-screen').getAttribute('role')).toBe('alert');
		expect(document.getElementById('startup-reload').hidden).toBe(false);
	});
});
