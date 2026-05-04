/**
 * CHIVE Data Ingest Service
 *
 * Host-side wrapper for the data-ingest Web Worker. Spawns one worker per
 * call, forwards progress messages via the supplied callback, and resolves
 * with an ok/fail result when the worker reports `done` or `error` (or when
 * the caller's AbortSignal fires).
 *
 * The worker constructor is loaded lazily via a dynamic `?worker` import so
 * tests can pre-empt it via `__setIngestWorkerFactoryForTesting`.
 */

import { ok, fail } from '../utils/result.js';
import { t } from './i18nService.js';

/**
 * Map a worker progress stage to a localized user-facing label.
 * Caller passes the file (or preset) name so the parsing label can include it.
 */
export function progressLabelForStage(stage, fileName) {
	if (stage === 'parsing') return t('chive-progress-parsing', [fileName]);
	if (stage === 'decimal-detection' || stage === 'type-detection') return t('chive-progress-detecting-types');
	if (stage === 'normalize') return t('chive-progress-normalizing');
	if (stage === 'stats') return t('chive-progress-computing-stats');
	return undefined;
}

let workerFactory = null;

/**
 * Test seam — replace the worker constructor with a stub that mimics the
 * postMessage / onmessage / terminate surface. Called by Vitest suites; not
 * used in production code.
 */
export function __setIngestWorkerFactoryForTesting(factory) {
	workerFactory = factory;
}

async function spawnIngestWorker() {
	if (workerFactory) return workerFactory();
	const module = await import('../workers/dataIngestWorker.js?worker');
	return new module.default();
}

function generateId() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `ingest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Run the ingest pipeline in a worker.
 *
 * @param {{ kind: 'csv' | 'json', text: string, options?: { rowLimit?: number } }} input
 * @param {{ onProgress?: (p: { stage: string, percent: number, label?: string }) => void, signal?: AbortSignal }} [config]
 * @returns {Promise<{ ok: true, value: object } | { ok: false, reason: string }>}
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
				if (typeof onProgress === 'function') {
					onProgress({ stage: message.stage, percent: message.percent, label: message.label });
				}
				return;
			}

			if (message.type === 'done') {
				finalize();
				resolve(ok({ value: message.result }));
				return;
			}

			if (message.type === 'error') {
				finalize();
				resolve(fail(message.message || 'ingest-error'));
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
