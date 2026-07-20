/**
 * CHIVE application page entry (index.html).
 *
 * Application initialization lives in app/applicationInitializer.js. This
 * module owns DOM readiness and defers the browser-console debug surface until
 * successful startup and an idle period.
 */

import { startApplication } from '../app/applicationInitializer.js';

function scheduleDebugApi() {
	const install = () => {
		import('../app/debugApi.js')
			.then(({ installDebugApi }) => installDebugApi())
			.catch(error => console.warn('CHIVE debug API could not be installed:', error));
	};
	if (typeof window.requestIdleCallback === 'function') {
		window.requestIdleCallback(install);
	} else {
		window.setTimeout(install, 0);
	}
}

async function start() {
	const started = await startApplication();
	if (started) scheduleDebugApi();
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', start);
} else {
	void start();
}
