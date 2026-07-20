/**
 * CHIVE About page entry (about.html).
 *
 * The About page needs only the shared header behavior (i18n and the settings
 * button), so this entry imports the shared-page initializer and nothing from
 * the application, debug, or feedback graphs. Keeping those imports out is what
 * spares the About page the chart, state, panel, and persistence bundles.
 *
 * initializeSharedPage is async, so its error boundary awaits inside a try:
 * on a rejected i18n or storage read this reveals the body (i18n reveals it on
 * success) and logs, rather than leaving the pre-hidden body stuck. The About
 * page deliberately does not route errors through the application feedback UI,
 * which would pull application modules back into this entry.
 */

import { initializeSharedPage } from '../app/sharedPageInitializer.js';
import { failStartupScreen, revealPageShell } from '../app/startupScreen.js';

async function startAboutPage() {
	try {
		await initializeSharedPage();
		revealPageShell();
	} catch (error) {
		failStartupScreen();
		console.error('CHIVE About-page initialization failed:', error);
	}
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', startAboutPage);
} else {
	startAboutPage();
}
