/**
 * Bounded, session-only error evidence. No Error objects or application payloads
 * are retained. Raw messages/stacks are for local inspection only; the report
 * deliberately omits them because arbitrary exception text can contain data.
 */

export const ERROR_LOG_LIMIT = 50;
const errors = [];
let nextErrorId = 1;
let startup = { status: 'not-started', stage: null, startedAt: null, updatedAt: null };

const ERROR_TYPES = new Set([
	'startup-error', 'state-listener-error', 'state-wildcard-listener-error',
	'refresh-error', 'persistence-load-error', 'persistence-save-error',
	'persistence-legacy-error', 'persistence-worker-error', 'debug-api-error',
	'uncaught-error', 'unhandled-rejection',
]);
const STARTUP_STAGES = new Set([
	'loading-modules', 'shared-setup', 'restoring-state', 'preparing-ui', 'rendering', 'ready',
]);

function readText(value, key, limit) {
	try {
		const text = key ? value?.[key] : value;
		return typeof text === 'string' ? text.slice(0, limit) : '';
	} catch {
		// Thrown values may have accessors that themselves throw.
		return '';
	}
}

/** Capture strings immediately, never the thrown object (or its cause graph). */
export function recordDiagnosticError(type, error, eventType = null) {
	const entry = {
		id: nextErrorId++,
		t: Date.now(),
		type: ERROR_TYPES.has(type) ? type : 'unknown',
		eventType: typeof eventType === 'string' ? eventType.slice(0, 80) : null,
		name: readText(error, 'name', 80) || 'Error',
		message: readText(error, 'message', 2000) || readText(error, null, 2000),
		stack: readText(error, 'stack', 8000),
	};
	if (errors.length === ERROR_LOG_LIMIT) errors.shift();
	errors.push(entry);
	return { ...entry };
}

/** Local-only details; each returned record is detached from the buffer. */
export function getErrorLog() {
	return errors.map(entry => ({ ...entry }));
}

export function clearErrorLog() {
	errors.length = 0;
}

export function setStartupStage(stage) {
	if (!STARTUP_STAGES.has(stage)) return;
	const now = Date.now();
	startup = {
		status: stage === 'ready' ? 'ready' : 'starting',
		stage,
		startedAt: startup.startedAt ?? now,
		updatedAt: now,
	};
}

export function recordStartupFailure(error) {
	startup = { ...startup, status: 'failed', updatedAt: Date.now() };
	recordDiagnosticError('startup-error', error);
}

export function getStartupStatus() {
	return { ...startup };
}
