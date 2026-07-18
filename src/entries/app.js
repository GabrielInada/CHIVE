/**
 * CHIVE application page entry (index.html).
 *
 * Application initialization lives in app/applicationInitializer.js. This
 * module owns only DOM readiness and installation of the browser-console
 * debug surface. The debug surface is installed on the application page only;
 * the About page uses entries/about.js and never gets it.
 */

import { startApplication } from '../app/applicationInitializer.js';
import { installDebugApi } from '../app/debugApi.js';

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', startApplication);
} else {
	startApplication();
}

installDebugApi();
