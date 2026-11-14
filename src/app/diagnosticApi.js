/** Lightweight console reads, available before the application module loads. */

import {
	clearErrorLog, ERROR_LOG_LIMIT, getErrorLog, getStartupStatus, recordDiagnosticError,
} from '../services/diagnostics.js';
import {
	clearStateLog, disableStateLog, enableStateLog, getStateLog,
	isStateLogEnabled, STATE_EVENTS, STATE_LOG_LIMIT,
} from '../state/stateEvents.js';

const eventNames = new Set(Object.values(STATE_EVENTS));
const ERROR_NAMES = new Set([
	'Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError',
	'EvalError', 'AggregateError', 'AbortError', 'QuotaExceededError', 'SecurityError',
	'InvalidStateError', 'NotFoundError', 'DataCloneError', 'NetworkError', 'TimeoutError',
]);
const listenersByTarget = new WeakMap();
let readStateSummary = null;
let readPersistence = null;

/** Attach readers after the application module loads; no UI initialization is needed. */
export function configureDiagnosticReaders({ getStateSummary, getPersistenceDiagnostics }) {
	readStateSummary = getStateSummary;
	readPersistence = getPersistenceDiagnostics;
}

function readOrNull(reader) {
	try {
		return typeof reader === 'function' ? reader() : null;
	} catch {
		return null;
	}
}

function readEnvironment(target) {
	const ua = target?.navigator?.userAgent || '';
	const match = /(?:Firefox|Edg|Chrome|Version)\/(\d+)/.exec(ua);
	const browser = ua.includes('Firefox/') ? 'Firefox'
		: ua.includes('Edg/') ? 'Edge'
			: ua.includes('Chrome/') ? 'Chromium'
				: ua.includes('Safari/') ? 'Safari' : 'unknown';
	return {
		browser,
		browserMajor: match ? Number(match[1]) : null,
		secureContext: typeof target?.isSecureContext === 'boolean' ? target.isSecureContext : null,
		workerSupported: typeof target?.Worker === 'function',
	};
}

/**
 * Export policy: only metadata from explicit projections. Raw messages, stack
 * strings, custom error names and unknown event names are NEVER copied. Scrubbing
 * emails/URLs alone cannot reliably remove arbitrary uploaded cell values.
 */
function getDiagnosticReport(target) {
	return {
		schemaVersion: 1,
		generatedAt: new Date().toISOString(),
		application: { name: 'CHIVE', version: null },
		environment: readEnvironment(target),
		startup: getStartupStatus(),
		state: readOrNull(readStateSummary),
		persistence: readOrNull(readPersistence) || {
			available: null,
			backend: { mode: 'unknown' },
			load: { status: 'unknown', t: null },
			save: { status: 'unknown', t: null },
		},
		capture: {
			stateLogEnabled: isStateLogEnabled(),
			eventLimit: STATE_LOG_LIMIT,
			errorLimit: ERROR_LOG_LIMIT,
			storage: 'memory-only',
			errorDetails: 'omitted; inspect getErrorLog() locally',
		},
		events: getStateLog(),
		errors: getErrorLog().map(entry => ({
			id: entry.id,
			t: entry.t,
			type: entry.type,
			eventType: eventNames.has(entry.eventType) ? entry.eventType : null,
			name: ERROR_NAMES.has(entry.name) ? entry.name : 'Error',
			hasStack: Boolean(entry.stack),
		})),
	};
}

export function createDiagnosticApi(target = window) {
	return {
		getStateSummary: () => readOrNull(readStateSummary),
		getStartupStatus,
		getErrorLog,
		clearErrorLog,
		enableStateLog,
		disableStateLog,
		getStateLog,
		clearStateLog,
		getDiagnosticReport: () => getDiagnosticReport(target),
		exportDiagnosticReport: () => JSON.stringify(getDiagnosticReport(target), null, 2),
	};
}

/** Idempotent installation; native errors are observed without suppressing them. */
export function installDiagnosticApi(target = window) {
	if (!listenersByTarget.has(target)) {
		const onError = event => recordDiagnosticError('uncaught-error', event.error || event.message);
		const onRejection = event => recordDiagnosticError('unhandled-rejection', event.reason);
		target.addEventListener('error', onError);
		target.addEventListener('unhandledrejection', onRejection);
		listenersByTarget.set(target, { onError, onRejection });
	}

	target.chiveDebug = Object.assign(target.chiveDebug || {}, createDiagnosticApi(target));
	return target.chiveDebug;
}
