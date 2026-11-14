/** Install diagnostics before loading the application and its dependencies. */

import { installDiagnosticApi } from './diagnosticApi.js';
import { failStartupScreen } from './startupScreen.js';
import {
	recordDiagnosticError, recordStartupFailure, setStartupStage,
} from '../services/diagnostics.js';

function scheduleDebugApi() {
	const install = () => {
		import('./debugApi.js')
			.then(({ installDebugApi }) => installDebugApi())
			.catch(error => {
				recordDiagnosticError('debug-api-error', error);
				console.warn('CHIVE debug API could not be installed:', error);
			});
	};
	if (typeof window.requestIdleCallback === 'function') {
		window.requestIdleCallback(install);
	} else {
		window.setTimeout(install, 0);
	}
}

export async function startApplicationPage() {
	installDiagnosticApi();
	setStartupStage('loading-modules');
	try {
		const { startApplication } = await import('./applicationInitializer.js');
		if (await startApplication()) scheduleDebugApi();
	} catch (error) {
		// Covers module fetch/evaluation failures before the initializer can run.
		recordStartupFailure(error);
		console.error('CHIVE application could not be loaded:', error);
		failStartupScreen();
	}
}
