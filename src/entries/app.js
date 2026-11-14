/**
 * CHIVE application page entry (index.html).
 *
 * Owns DOM readiness. The bootstrap installs lightweight diagnostics before
 * loading the application, then defers the full console toolkit until idle.
 */

import { startApplicationPage } from '../app/applicationBootstrap.js';

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', startApplicationPage);
} else {
	void startApplicationPage();
}
