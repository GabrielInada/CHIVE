import { beforeEach, describe, expect, it, vi } from 'vitest';

let diagnostics;
beforeEach(async () => {
	vi.resetModules();
	diagnostics = await import('../../src/services/diagnostics.js');
});

describe('diagnostic evidence', () => {
	it('retains bounded, detached strings instead of Error objects and cause graphs', () => {
		const error = new Error('private '.repeat(500));
		error.stack = 's'.repeat(10000);
		error.cause = error;
		for (let index = 0; index < 55; index += 1) {
			diagnostics.recordDiagnosticError('refresh-error', error);
		}
		error.message = 'changed';
		const log = diagnostics.getErrorLog();
		expect(log).toHaveLength(50);
		expect(log[0].id).toBe(6);
		expect(log[0].message).toHaveLength(2000);
		expect(log[0].stack).toHaveLength(8000);
		expect(log[0]).not.toHaveProperty('cause');
		log[0].message = 'injected';
		expect(diagnostics.getErrorLog()[0].message).not.toBe('injected');
		diagnostics.clearErrorLog();
		expect(diagnostics.getErrorLog()).toEqual([]);
	});

	it('records thrown primitives and tolerates hostile error accessors', () => {
		diagnostics.recordDiagnosticError('startup-error', 'plain rejection');
		const hostile = new Proxy({}, { get() { throw new Error('access denied'); } });
		expect(() => diagnostics.recordDiagnosticError('startup-error', hostile)).not.toThrow();
		expect(diagnostics.getErrorLog()[0].message).toBe('plain rejection');
		expect(diagnostics.getErrorLog()[1]).toMatchObject({ name: 'Error', message: '', stack: '' });
	});

	it('retains the failing startup stage and distinguishes not-started, pending and ready', () => {
		expect(diagnostics.getStartupStatus().status).toBe('not-started');
		diagnostics.setStartupStage('loading-modules');
		expect(diagnostics.getStartupStatus().status).toBe('starting');
		diagnostics.setStartupStage('restoring-state');
		diagnostics.recordStartupFailure(new Error('failed'));
		expect(diagnostics.getStartupStatus()).toMatchObject({ status: 'failed', stage: 'restoring-state' });
		diagnostics.getStartupStatus().stage = 'changed';
		expect(diagnostics.getStartupStatus().stage).toBe('restoring-state');
		diagnostics.setStartupStage('ready');
		expect(diagnostics.getStartupStatus().status).toBe('ready');
	});
});
