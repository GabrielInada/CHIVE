// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	configureDiagnosticReaders, createDiagnosticApi, installDiagnosticApi,
} from '../../src/app/diagnosticApi.js';
import { clearErrorLog, getErrorLog, recordDiagnosticError } from '../../src/services/diagnostics.js';
import { clearStateLog, disableStateLog, emitStateChange, STATE_EVENTS } from '../../src/state/stateEvents.js';
import { applyStateSnapshot } from '../../src/state/appState.js';
import { getStateSummary } from '../../src/state/stateDebug.js';
import { configurePersistenceBackend, getPersistenceDiagnostics } from '../../src/services/persistence.js';

beforeEach(() => {
	configureDiagnosticReaders({});
	clearErrorLog();
	clearStateLog();
	disableStateLog();
	vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
	disableStateLog();
	configurePersistenceBackend(null);
});

describe('diagnostic console API', () => {
	it('composes real state and persistence readers without serializing uploaded payloads', () => {
		const row = { secret: 'private-cell' };
		row.self = row;
		applyStateSnapshot({
			data: { datasets: [{ name: 'private-file.csv', rows: [row], columns: [{ name: 'secret', type: 'text' }] }], activeIndex: 0 },
		});
		configurePersistenceBackend({ available: () => false });
		configureDiagnosticReaders({ getStateSummary, getPersistenceDiagnostics });
		const report = JSON.parse(createDiagnosticApi().exportDiagnosticReport());
		expect(report.state).toMatchObject({ datasetsCount: 1, activeDatasetIndex: 0 });
		expect(report.persistence).toMatchObject({ available: false, load: { status: 'not-started' } });
		expect(JSON.stringify(report)).not.toMatch(/private-cell|private-file|secret/);
	});

	it('reports unknown readers before the application is loaded, including reader failures', () => {
		const api = createDiagnosticApi();
		expect(api.getStateSummary()).toBeNull();
		expect(api.getDiagnosticReport()).toMatchObject({
			schemaVersion: 1,
			state: null,
			persistence: { available: null, load: { status: 'unknown' }, save: { status: 'unknown' } },
			capture: { stateLogEnabled: false, storage: 'memory-only' },
		});
		configureDiagnosticReaders({ getStateSummary: () => { throw new Error('reader failed'); } });
		expect(() => JSON.parse(api.exportDiagnosticReport())).not.toThrow();
	});

	it('exports metadata without uploaded names, values, config text, exception text, URLs or custom names', () => {
		const api = createDiagnosticApi();
		api.enableStateLog();
		const secret = 'payroll-person@example.com';
		emitStateChange(STATE_EVENTS.DATASET_ADDED, {
			index: 0, dataset: { name: `${secret}.csv`, rows: [{ salary: secret }], columns: [{ name: secret }] },
		});
		emitStateChange(STATE_EVENTS.COLUMN_SELECTION_CHANGED, [secret]);
		emitStateChange(STATE_EVENTS.DATASET_CONFIG_UPDATED, { bar: { title: secret }, [secret]: secret });
		emitStateChange(secret, { data: secret });
		const error = new Error(secret);
		error.name = secret;
		error.stack = `Error: ${secret}\nat privateFunction (https://private-host/${secret}?token=123:1:2)`;
		recordDiagnosticError('state-listener-error', error, secret);
		const exported = api.exportDiagnosticReport();
		expect(exported).not.toMatch(/payroll|salary|privateFunction|private-host|token=123/);
		const report = JSON.parse(exported);
		expect(report.errors[0]).toMatchObject({ type: 'state-listener-error', name: 'Error', eventType: null, hasStack: true });
		expect(report.errors[0]).not.toHaveProperty('message');
		expect(report.errors[0]).not.toHaveProperty('stack');
		expect(api.getErrorLog()[0]).toMatchObject({ message: secret, stack: error.stack });
		expect(report.events[0].data).toEqual({ index: 0, rowsCount: 1, columnsCount: 1 });
		api.clearErrorLog();
		api.clearStateLog();
		expect(api.getDiagnosticReport()).toMatchObject({ errors: [], events: [] });
	});

	it('installs native error capture once and does not cancel browser reporting', () => {
		const target = new window.EventTarget();
		const early = installDiagnosticApi(target);
		expect(installDiagnosticApi(target)).toBe(early);
		const error = new Error('native crash');
		const event = new window.ErrorEvent('error', { error, cancelable: true });
		expect(target.dispatchEvent(event)).toBe(true);
		const rejection = new Event('unhandledrejection', { cancelable: true });
		Object.defineProperty(rejection, 'reason', { value: 'rejected' });
		expect(target.dispatchEvent(rejection)).toBe(true);
		expect(getErrorLog()).toHaveLength(2);
		expect(getErrorLog()[0]).toMatchObject({ type: 'uncaught-error', stack: error.stack });
		expect(getErrorLog()[1]).toMatchObject({ type: 'unhandled-rejection', message: 'rejected' });
	});
});
