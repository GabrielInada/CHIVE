// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	ingestFile,
	progressLabelForStage,
	ingestErrorMessage,
	__setIngestWorkerFactoryForTesting,
} from '../../src/services/dataIngestService.js';
import { t } from '../../src/services/i18nService.js';

class MockWorker {
	constructor() {
		this.terminated = false;
		this.onmessage = null;
		this.onerror = null;
		this.postMessages = [];
		this._handler = null;
	}
	onPost(handler) {
		this._handler = handler;
	}
	postMessage(data) {
		this.postMessages.push(data);
		if (this._handler) this._handler(data, this);
	}
	terminate() {
		this.terminated = true;
	}
	emit(message) {
		if (this.onmessage) this.onmessage({ data: message });
	}
	emitError(event) {
		if (this.onerror) this.onerror(event);
	}
}

describe('ingestFile', () => {
	let worker;

	beforeEach(() => {
		worker = new MockWorker();
		__setIngestWorkerFactoryForTesting(() => worker);
	});

	afterEach(() => {
		__setIngestWorkerFactoryForTesting(null);
	});

	it('forwards progress messages and resolves with the worker result on done', async () => {
		const onProgress = vi.fn();

		worker.onPost((data, w) => {
			queueMicrotask(() => {
				w.emit({ id: data.id, type: 'progress', stage: 'parsing', percent: 30 });
				w.emit({ id: data.id, type: 'progress', stage: 'normalize', percent: 70 });
				w.emit({
					id: data.id,
					type: 'done',
					result: {
						rows: [{ x: 1 }],
						columns: [{ name: 'x', type: 'number' }],
						decimalSeparator: '.',
						statsNumeric: [],
						statsCategorical: [],
						truncatedFrom: null,
					},
				});
			});
		});

		const result = await ingestFile({ kind: 'csv', text: 'x\n1' }, { onProgress });

		expect(result.ok).toBe(true);
		expect(result.value.rows).toEqual([{ x: 1 }]);
		expect(onProgress).toHaveBeenCalledTimes(2);
		expect(onProgress).toHaveBeenNthCalledWith(1, { stage: 'parsing', percent: 30, label: undefined });
		expect(onProgress).toHaveBeenNthCalledWith(2, { stage: 'normalize', percent: 70, label: undefined });
		expect(worker.terminated).toBe(true);
	});

	it('forwards options including rowLimit and dropColumns to the worker', async () => {
		worker.onPost((data, w) => {
			queueMicrotask(() => {
				w.emit({ id: data.id, type: 'done', result: { rows: [], columns: [], decimalSeparator: '.', statsNumeric: [], statsCategorical: [], truncatedFrom: null } });
			});
		});

		await ingestFile(
			{ kind: 'csv', text: 'x', options: { rowLimit: 100, dropColumns: ['drop_me'] } },
		);

		expect(worker.postMessages).toHaveLength(1);
		expect(worker.postMessages[0].kind).toBe('csv');
		expect(worker.postMessages[0].options).toEqual({ rowLimit: 100, dropColumns: ['drop_me'] });
	});

	it('uses a counter fallback for worker message ids when crypto.randomUUID is unavailable', async () => {
		const originalCrypto = globalThis.crypto;
		vi.stubGlobal('crypto', {});
		const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
			throw new Error('Math.random should not be called for ingest ids');
		});

		try {
			worker.onPost((data, w) => {
				expect(data.id).toMatch(/^ingest-\d+-\d+$/);
				queueMicrotask(() => {
					w.emit({ id: data.id, type: 'done', result: { rows: [], columns: [], decimalSeparator: '.', statsNumeric: [], statsCategorical: [], truncatedFrom: null } });
				});
			});

			const result = await ingestFile({ kind: 'csv', text: 'x' });

			expect(result.ok).toBe(true);
			expect(randomSpy).not.toHaveBeenCalled();
		} finally {
			randomSpy.mockRestore();
			vi.stubGlobal('crypto', originalCrypto);
		}
	});

	it('resolves with cancelled when the AbortSignal fires before done', async () => {
		const controller = new AbortController();

		// Worker receives postMessage but never replies, caller will abort.
		worker.onPost(() => {});

		const promise = ingestFile({ kind: 'csv', text: 'x\n1' }, { signal: controller.signal });

		// Yield so the Promise constructor's setup (onmessage assignment, signal listener,
		// initial postMessage) has run before we abort.
		await Promise.resolve();

		controller.abort();

		const result = await promise;
		expect(result.ok).toBe(false);
		expect(result.reason).toBe('cancelled');
		expect(worker.terminated).toBe(true);
	});

	it('returns cancelled immediately when the signal is already aborted', async () => {
		const controller = new AbortController();
		controller.abort();

		const result = await ingestFile({ kind: 'csv', text: 'x\n1' }, { signal: controller.signal });
		expect(result.ok).toBe(false);
		expect(result.reason).toBe('cancelled');
	});

	it('resolves with the message reason when the worker posts type=error', async () => {
		worker.onPost((data, w) => {
			queueMicrotask(() => {
				w.emit({ id: data.id, type: 'error', message: 'parse-failed' });
			});
		});

		const result = await ingestFile({ kind: 'csv', text: 'invalid' });
		expect(result.ok).toBe(false);
		expect(result.reason).toBe('parse-failed');
		expect(worker.terminated).toBe(true);
	});

	it('prefers the reason field over message on a type=error', async () => {
		worker.onPost((data, w) => {
			queueMicrotask(() => {
				w.emit({ id: data.id, type: 'error', reason: 'csv-empty', message: 'legacy-text' });
			});
		});

		const result = await ingestFile({ kind: 'csv', text: 'invalid' });
		expect(result.reason).toBe('csv-empty');
	});

	it('falls back to message when reason is not a string', async () => {
		worker.onPost((data, w) => {
			queueMicrotask(() => {
				w.emit({ id: data.id, type: 'error', reason: 123, message: 'legacy-text' });
			});
		});

		const result = await ingestFile({ kind: 'csv', text: 'invalid' });
		expect(result.reason).toBe('legacy-text');
	});

	it('falls back to ingest-error for a garbage error payload', async () => {
		worker.onPost((data, w) => {
			queueMicrotask(() => {
				w.emit({ id: data.id, type: 'error', reason: 123, message: null });
			});
		});

		const result = await ingestFile({ kind: 'csv', text: 'invalid' });
		expect(result.reason).toBe('ingest-error');
	});

	it('ignores stale messages whose id does not match the in-flight request', async () => {
		const onProgress = vi.fn();

		worker.onPost((data, w) => {
			queueMicrotask(() => {
				w.emit({ id: 'wrong-id', type: 'progress', stage: 'parsing', percent: 50 });
				w.emit({ id: data.id, type: 'done', result: { rows: [], columns: [], decimalSeparator: '.', statsNumeric: [], statsCategorical: [], truncatedFrom: null } });
			});
		});

		const result = await ingestFile({ kind: 'csv', text: 'x' }, { onProgress });
		expect(result.ok).toBe(true);
		expect(onProgress).not.toHaveBeenCalled();
	});

	it('handles worker.onerror as a fail result', async () => {
		worker.onPost((_, w) => {
			queueMicrotask(() => w.emitError({ message: 'spawn-died' }));
		});

		const result = await ingestFile({ kind: 'csv', text: 'x' });
		expect(result.ok).toBe(false);
		expect(result.reason).toBe('spawn-died');
		expect(worker.terminated).toBe(true);
	});
});

describe('ingestFile message validation', () => {
	let worker;

	beforeEach(() => {
		worker = new MockWorker();
		__setIngestWorkerFactoryForTesting(() => worker);
	});

	afterEach(() => {
		__setIngestWorkerFactoryForTesting(null);
	});

	function validResult() {
		return { rows: [], columns: [], decimalSeparator: '.', statsNumeric: [], statsCategorical: [], truncatedFrom: null };
	}

	it('skips a progress message with a non-string stage', async () => {
		const onProgress = vi.fn();
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		worker.onPost((data, w) => {
			queueMicrotask(() => {
				w.emit({ id: data.id, type: 'progress', stage: 42, percent: 50 });
				w.emit({ id: data.id, type: 'done', result: validResult() });
			});
		});

		const result = await ingestFile({ kind: 'csv', text: 'x' }, { onProgress });

		expect(result.ok).toBe(true);
		expect(onProgress).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalledWith('[chive:ingest] skipping malformed progress message', expect.any(Object));
		warn.mockRestore();
	});

	it('skips a progress message with non-finite percent', async () => {
		const onProgress = vi.fn();
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		worker.onPost((data, w) => {
			queueMicrotask(() => {
				w.emit({ id: data.id, type: 'progress', stage: 'parsing', percent: NaN });
				w.emit({ id: data.id, type: 'done', result: validResult() });
			});
		});

		const result = await ingestFile({ kind: 'csv', text: 'x' }, { onProgress });

		expect(result.ok).toBe(true);
		expect(onProgress).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it('skips a progress message with out-of-range percent', async () => {
		const onProgress = vi.fn();
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		worker.onPost((data, w) => {
			queueMicrotask(() => {
				w.emit({ id: data.id, type: 'progress', stage: 'parsing', percent: 150 });
				w.emit({ id: data.id, type: 'done', result: validResult() });
			});
		});

		const result = await ingestFile({ kind: 'csv', text: 'x' }, { onProgress });

		expect(result.ok).toBe(true);
		expect(onProgress).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it('forwards a progress message with a non-string label but coerces label to undefined', async () => {
		const onProgress = vi.fn();

		worker.onPost((data, w) => {
			queueMicrotask(() => {
				w.emit({ id: data.id, type: 'progress', stage: 'parsing', percent: 30, label: 42 });
				w.emit({ id: data.id, type: 'done', result: validResult() });
			});
		});

		const result = await ingestFile({ kind: 'csv', text: 'x' }, { onProgress });

		expect(result.ok).toBe(true);
		expect(onProgress).toHaveBeenCalledTimes(1);
		expect(onProgress).toHaveBeenCalledWith({ stage: 'parsing', percent: 30, label: undefined });
	});

	it('resolves fail when done.result is null', async () => {
		worker.onPost((data, w) => {
			queueMicrotask(() => {
				w.emit({ id: data.id, type: 'done', result: null });
			});
		});

		const result = await ingestFile({ kind: 'csv', text: 'x' });

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('ingest-malformed-result');
		expect(worker.terminated).toBe(true);
	});

	it('resolves fail when done.result is a non-object', async () => {
		worker.onPost((data, w) => {
			queueMicrotask(() => {
				w.emit({ id: data.id, type: 'done', result: 'oops' });
			});
		});

		const result = await ingestFile({ kind: 'csv', text: 'x' });

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('ingest-malformed-result');
		expect(worker.terminated).toBe(true);
	});

	it('resolves fail when done.result is an array', async () => {
		worker.onPost((data, w) => {
			queueMicrotask(() => {
				w.emit({ id: data.id, type: 'done', result: [{ x: 1 }] });
			});
		});

		const result = await ingestFile({ kind: 'csv', text: 'x' });

		expect(result.ok).toBe(false);
		expect(result.reason).toBe('ingest-malformed-result');
		expect(worker.terminated).toBe(true);
	});
});

describe('progressLabelForStage', () => {
	it('maps each known stage to a non-empty string', () => {
		const fileName = 'iris.csv';
		expect(progressLabelForStage('parsing', fileName)).toBeTruthy();
		expect(progressLabelForStage('decimal-detection', fileName)).toBeTruthy();
		expect(progressLabelForStage('type-detection', fileName)).toBeTruthy();
		expect(progressLabelForStage('normalize', fileName)).toBeTruthy();
		expect(progressLabelForStage('stats', fileName)).toBeTruthy();
	});

	it('returns undefined for unknown stages', () => {
		expect(progressLabelForStage('mystery', 'x')).toBeUndefined();
	});
});

describe('ingestErrorMessage', () => {
	it('maps a known parse reason to its localized message', () => {
		// Compare against t(key) (not an English literal) so it is locale-independent.
		expect(ingestErrorMessage('csv-empty')).toBe(t('chive-ingest-error-csv-empty'));
		expect(ingestErrorMessage('json-syntax')).toBe(t('chive-ingest-error-json-syntax'));
		expect(ingestErrorMessage('json-unrecognized')).toBe(t('chive-ingest-error-json-unrecognized'));
	});

	it('returns an unknown non-empty reason unchanged as a diagnostic', () => {
		expect(ingestErrorMessage('worker-error')).toBe('worker-error');
	});

	it('returns the neutral ingest-error id for a falsy reason (never undefined)', () => {
		expect(ingestErrorMessage('')).toBe('ingest-error');
		expect(ingestErrorMessage(undefined)).toBe('ingest-error');
	});
});
