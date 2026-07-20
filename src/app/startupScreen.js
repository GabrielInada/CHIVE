const SHELL_ID = 'app-shell';
const SCREEN_ID = 'startup-screen';

/**
 * @param {string} message
 */
export function updateStartupScreen(message) {
	window.chiveStartupGuard?.update(message);
}

/**
 * Reveal the initialized page shell and retire the startup screen.
 */
export function revealPageShell() {
	const shell = document.getElementById(SHELL_ID);
	const screen = document.getElementById(SCREEN_ID);
	if (shell) {
		shell.hidden = false;
		shell.inert = false;
	}
	if (screen) screen.hidden = true;
	window.chiveStartupGuard?.complete();
}

/**
 * Keep recovery visible after a fatal startup error.
 *
 * @param {string} message
 */
export function failStartupScreen(message = '') {
	window.chiveStartupGuard?.fail(message);
	const screen = document.getElementById(SCREEN_ID);
	const reload = document.getElementById('startup-reload');
	const messageElement = document.getElementById('startup-message');
	if (messageElement && message) messageElement.textContent = message;
	if (screen) screen.setAttribute('role', 'alert');
	if (reload) reload.hidden = false;
}
