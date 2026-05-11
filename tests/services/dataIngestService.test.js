// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	ingestFile,
	progressLabelForStage,
	__setIngestWorkerFactoryForTesting,
} from '../../src/services/dataIngestService.js';

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
						dados: [{ x: 1 }],
						colunas: [{ nome: 'x', tipo: 'numero' }],
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
		expect(result.value.dados).toEqual([{ x: 1 }]);
		expect(onProgress).toHaveBeenCalledTimes(2);
		expect(onProgress).toHaveBeenNthCalledWith(1, { stage: 'parsing', percent: 30, label: undefined });
		expect(onProgress).toHaveBeenNthCalledWith(2, { stage: 'normalize', percent: 70, label: undefined });
		expect(worker.terminated).toBe(true);
	});

	it('forwards options including rowLimit and dropColumns to the worker', async () => {
		worker.onPost((data, w) => {
			queueMicrotask(() => {
				w.emit({ id: data.id, type: 'done', result: { dados: [], colunas: [], decimalSeparator: '.', statsNumeric: [], statsCategorical: [], truncatedFrom: null } });
			});
		});

		await ingestFile(
			{ kind: 'csv', text: 'x', options: { rowLimit: 100, dropColumns: ['drop_me'] } },
		);

		expect(worker.postMessages).toHaveLength(1);
		expect(worker.postMessages[0].kind).toBe('csv');
		expect(worker.postMessages[0].options).toEqual({ rowLimit: 100, dropColumns: ['drop_me'] });
	});

	it('resolves with cancelled when the AbortSignal fires before done', async () => {
		const controller = new AbortController();

		// Worker receives postMessage but never replies — caller will abort.
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

	it('ignores stale messages whose id does not match the in-flight request', async () => {
		const onProgress = vi.fn();

		worker.onPost((data, w) => {
			queueMicrotask(() => {
				w.emit({ id: 'wrong-id', type: 'progress', stage: 'parsing', percent: 50 });
				w.emit({ id: data.id, type: 'done', result: { dados: [], colunas: [], decimalSeparator: '.', statsNumeric: [], statsCategorical: [], truncatedFrom: null } });
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
