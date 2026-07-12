/**
 * CHIVE browser entrypoint.
 *
 * Application initialization lives in app/applicationInitializer.js. This
 * module owns only DOM readiness and installation of the browser-console
 * debug surface.
 */

import { startApplication } from './app/applicationInitializer.js';
import { installDebugApi } from './app/debugApi.js';

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', startApplication);
} else {
	startApplication();
}

installDebugApi();
