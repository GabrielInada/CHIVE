// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	failStartupScreen,
	revealPageShell,
	updateStartupScreen,
} from '../../src/app/startupScreen.js';

describe('startup screen lifecycle', () => {
	beforeEach(() => {
		document.body.innerHTML = `
			<div id="startup-screen" role="status">
				<p id="startup-message"></p>
				<button id="startup-reload" hidden></button>
			</div>
			<div id="app-shell" hidden inert></div>
		`;
		window.chiveStartupGuard = {
			update: vi.fn(),
			complete: vi.fn(),
			fail: vi.fn(),
		};
	});

	it('updates phases and reveals the initialized shell', () => {
		updateStartupScreen('Preparing');
		revealPageShell();

		const shell = document.getElementById('app-shell');
		expect(window.chiveStartupGuard.update).toHaveBeenCalledWith('Preparing');
		expect(shell.hidden).toBe(false);
		expect(shell.inert).toBe(false);
		expect(document.getElementById('startup-screen').hidden).toBe(true);
		expect(window.chiveStartupGuard.complete).toHaveBeenCalledTimes(1);
	});

	it('keeps recovery visible after a fatal error', () => {
		failStartupScreen('Failed');

		expect(window.chiveStartupGuard.fail).toHaveBeenCalledWith('Failed');
		expect(document.getElementById('startup-message').textContent).toBe('Failed');
		expect(document.getElementById('startup-screen').getAttribute('role')).toBe('alert');
		expect(document.getElementById('startup-reload').hidden).toBe(false);
		expect(document.getElementById('app-shell').hidden).toBe(true);
	});
});
