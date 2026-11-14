// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
	vi.doUnmock('../../src/app/applicationInitializer.js');
	vi.restoreAllMocks();
});

describe('application bootstrap failure', () => {
	it('keeps a report and recovery UI when the application module itself cannot load', async () => {
		vi.resetModules();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const failure = new Error('Failed to load private module URL');
		vi.doMock('../../src/app/applicationInitializer.js', () => { throw failure; });
		document.body.innerHTML = '<div id="startup-screen"></div><button id="startup-reload" hidden></button>';
		const { startApplicationPage } = await import('../../src/app/applicationBootstrap.js');

		await startApplicationPage();

		const report = window.chiveDebug.getDiagnosticReport();
		expect(report.startup).toMatchObject({ status: 'failed', stage: 'loading-modules' });
		expect(report.state).toBeNull();
		expect(report.errors[0].type).toBe('startup-error');
		expect(window.chiveDebug.getErrorLog()[0].stack).toBeTruthy();
		expect(window.chiveDebug.exportDiagnosticReport()).not.toContain('private module URL');
		expect(document.getElementById('startup-reload').hidden).toBe(false);
	});
});
