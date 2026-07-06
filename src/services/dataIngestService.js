/**
 * CHIVE Data Ingest Service.
 *
 * Host-side wrapper for the data-ingest Web Worker. Spawns one worker per
 * call, forwards progress messages via the supplied callback, and resolves
 * with an ok/fail result when the worker reports `done` or `error` (or when
 * the caller's AbortSignal fires).
 *
 * The worker is spawned lazily with the browser-native
 * `new Worker(new URL(...), { type: 'module' })` pattern so the app runs
 * unchanged under both raw static hosting (nginx) and Vite dev. Tests
 * pre-empt the spawn via `__setIngestWorkerFactoryForTesting`.
 *
 * @typedef {import('../types.js').IngestPayload} IngestPayload
 * @typedef {import('../types.js').IngestProgress} IngestProgress
 * @typedef {import('../types.js').Result} Result
 */

import { ok, fail } from '../utils/result.js';
import { t } from './i18nService.js';

/**
 * Map a worker progress stage to a localized user-facing label.
 * Caller passes the file (or preset) name so the parsing label can include it.
 *
 * @param {string} stage - One of `'parsing'`, `'decimal-detection'`, `'type-detection'`, `'normalize'`, `'stats'`.
 * @param {string} fileName - Used to interpolate into the `'parsing'` label.
 * @returns {string | undefined} Localized label, or `undefined` for unknown stages so the caller can keep the previous label visible.
 */
export function progressLabelForStage(stage, fileName) {
	if (stage === 'parsing') return t('chive-progress-parsing', [fileName]);
	if (stage === 'decimal-detection' || stage === 'type-detection') return t('chive-progress-detecting-types');
	if (stage === 'normalize') return t('chive-progress-normalizing');
	if (stage === 'stats') return t('chive-progress-computing-stats');
	return undefined;
}

/** Parser reason code -> i18n key for the localized parse-error detail. @private */
const INGEST_ERROR_KEYS = {
	'csv-empty': 'chive-ingest-error-csv-empty',
	'json-syntax': 'chive-ingest-error-json-syntax',
	'json-empty': 'chive-ingest-error-json-empty',
	'json-array-empty': 'chive-ingest-error-json-array-empty',
	'json-unrecognized': 'chive-ingest-error-json-unrecognized',
};

/**
 * Map an ingest failure `reason` (from {@link ingestFile}) to a user-facing
 * detail string. Known parse reasons resolve to a localized message; any other
 * non-empty reason is returned as-is (a diagnostic id like `'worker-error'`);
 * a falsy reason yields the neutral `'ingest-error'`.
 *
 * Never returns `undefined`, and never returns the generic parse-prefix text
 * (`chive-error-parse`) that callers add around it, so the toast cannot read
 * "Could not parse file: Could not parse file".
 *
 * @param {string} [reason]
 * @returns {string}
 */
export function ingestErrorMessage(reason) {
	const key = INGEST_ERROR_KEYS[reason];
	if (key) return t(key);
	if (reason) return String(reason);
	return 'ingest-error';
}

let workerFactory = null;
let ingestIdCounter = 0;

/**
 * Test seam, replace the worker constructor with a stub that mimics the
 * postMessage / onmessage / terminate surface. Called by Vitest suites; not
 * used in production code.
 *
 * @internal
 * @param {(() => Worker) | null} factory - Pass `null` to restore the real spawner.
 */
export function __setIngestWorkerFactoryForTesting(factory) {
	workerFactory = factory;
}

/**
 * @private
 */
async function spawnIngestWorker() {
	// WHY: lazy spawn, workers are only created on the first ingest call, not at
	// module load. A user who never uploads a file should never pay for the
	// worker thread. This is intentional async init, not a missed `init()` call.
	if (workerFactory) return workerFactory();
	return new Worker(
		new URL('../workers/dataIngestWorker.js', import.meta.url),
		{ type: 'module' },
	);
}

/**
 * @private
 */
function generateId() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	ingestIdCounter += 1;
	return `ingest-${Date.now()}-${ingestIdCounter}`;
}

/**
 * @private
 */
function isFiniteNumber(value) {
	return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Run the ingest pipeline in a worker. On success, the resolved
 * {@link Result} carries the parsed payload at `result.value` (an
 * {@link IngestPayload}). On failure, `result.reason` is a stable string
 * id (`'cancelled'`, `'worker-spawn-failed'`, `'worker-error'`,
 * `'ingest-error'`, `'ingest-malformed-result'`, …).
 *
 * The worker is terminated and the abort listener is removed before the
 * Promise settles, regardless of outcome.
 *
 * @param {{ kind: 'csv' | 'json', text: string, options?: { rowLimit?: number } }} input
 * @param {{ onProgress?: (progress: IngestProgress) => void, signal?: AbortSignal }} [config]
 * @returns {Promise<Result>} `{ ok: true, value: IngestPayload }` on success; `{ ok: false, reason }` otherwise.
 */
export async function ingestFile(input, config = {}) {
	const { onProgress, signal } = config;

	if (signal?.aborted) return fail('cancelled');

	let worker;
	try {
		worker = await spawnIngestWorker();
	} catch (err) {
		return fail(err?.message || 'worker-spawn-failed');
	}

	const id = generateId();

	return new Promise((resolve) => {
		let settled = false;

		const onAbort = () => {
			if (settled) return;
			finalize();
			resolve(fail('cancelled'));
		};

		const finalize = () => {
			settled = true;
			try { worker.terminate(); } catch { /* ignore */ }
			if (signal && typeof signal.removeEventListener === 'function') {
				signal.removeEventListener('abort', onAbort);
			}
		};

		worker.onmessage = (event) => {
			if (settled) return;
			const message = event.data || {};
			if (message.id !== id) return;

			if (message.type === 'progress') {
				const stageOk = typeof message.stage === 'string' && message.stage.length > 0;
				const percentOk = isFiniteNumber(message.percent) && message.percent >= 0 && message.percent <= 100;
				if (!stageOk || !percentOk) {
					console.warn('[chive:ingest] skipping malformed progress message', message);
					return;
				}
				if (typeof onProgress === 'function') {
					const label = typeof message.label === 'string' ? message.label : undefined;
					onProgress({ stage: message.stage, percent: message.percent, label });
				}
				return;
			}

			if (message.type === 'done') {
				if (!message.result || typeof message.result !== 'object' || Array.isArray(message.result)) {
					finalize();
					resolve(fail('ingest-malformed-result'));
					return;
				}
				finalize();
				resolve(ok({ value: message.result }));
				return;
			}

			if (message.type === 'error') {
				finalize();
				// Prefer the stable parser `reason`; fall back to the onmessage catch-all
				// `message`. Stay type-safe so a forged/garbage payload cannot put a
				// non-string on `result.reason`.
				const reason =
					typeof message.reason === 'string' && message.reason
						? message.reason
						: typeof message.message === 'string' && message.message
							? message.message
							: 'ingest-error';
				resolve(fail(reason));
			}
		};

		worker.onerror = (event) => {
			if (settled) return;
			finalize();
			resolve(fail(event?.message || 'worker-error'));
		};

		if (signal && typeof signal.addEventListener === 'function') {
			signal.addEventListener('abort', onAbort, { once: true });
		}

		worker.postMessage({ id, kind: input.kind, text: input.text, options: input.options || {} });
	});
}
