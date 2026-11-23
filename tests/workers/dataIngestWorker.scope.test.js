import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ingestDataset } from '../../src/domain/datasets/ingest.js';

/**
 * The worker registers `self.onmessage` only inside a dedicated worker scope.
 * A stand-in scope class plus a matching `self` makes the module take that
 * path on import, so these tests drive the real message protocol.
 */
async function loadWorkerScope() {
	class FakeDedicatedWorkerGlobalScope {}
	const scope = new FakeDedicatedWorkerGlobalScope();
	scope.postMessage = vi.fn();
	vi.stubGlobal('DedicatedWorkerGlobalScope', FakeDedicatedWorkerGlobalScope);
	vi.stubGlobal('self', scope);
	vi.resetModules();
	await import('../../src/workers/dataIngestWorker.js');
	return {
		scope,
		send: data => scope.onmessage({ data }),
		posted: () => scope.postMessage.mock.calls.map(([message]) => message),
	};
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('dataIngestWorker message handler', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('registers no handler outside a dedicated worker scope', async () => {
		const scope = {};
		vi.stubGlobal('self', scope);
		vi.resetModules();
		await import('../../src/workers/dataIngestWorker.js');
		expect(scope.onmessage).toBeUndefined();
	});

	describe('inside a worker scope', () => {
		let worker;
		beforeEach(async () => {
			worker = await loadWorkerScope();
		});

		it('ingests a request and posts the result under its id', async () => {
			const request = { kind: 'csv', text: 'a,b\n1,2\n' };
			const expected = ingestDataset(request);

			worker.send({ id: 'r1', ...request });
			await flush();

			expect(worker.posted().at(-1)).toEqual({ id: 'r1', type: 'done', result: expected.value });
		});

		it('waits at the row count until a continue with the same id arrives', async () => {
			const request = { kind: 'csv', text: 'a,b\n1,2\n3,4\n' };

			worker.send({ id: 'r2', ...request, options: { awaitRowCount: true } });
			await flush();
			expect(worker.posted().at(-1)).toEqual({ id: 'r2', type: 'row-count', rowCount: 2, columnCount: 2 });

			worker.send({ type: 'continue', id: 'someone-else' });
			await flush();
			expect(worker.posted().some(message => message.type === 'done')).toBe(false);

			worker.send({ type: 'continue', id: 'r2' });
			await flush();
			expect(worker.posted().at(-1)).toMatchObject({ id: 'r2', type: 'done' });

			const count = worker.posted().length;
			worker.send({ type: 'continue', id: 'r2' });
			await flush();
			expect(worker.posted()).toHaveLength(count);
		});

		it('ignores a continue when nothing is waiting', async () => {
			worker.send({ type: 'continue', id: 'r3' });
			await flush();
			expect(worker.scope.postMessage).not.toHaveBeenCalled();
		});

		it('treats an empty message as a request and reports the ingest reason', async () => {
			worker.send(null);
			await flush();

			expect(worker.posted().at(-1)).toEqual({ id: undefined, type: 'error', reason: 'csv-empty' });
		});

		it('reports an unexpected throw with its message', async () => {
			const request = { id: 'r4', get kind() { throw new Error('boom'); } };

			worker.send(request);
			await flush();

			expect(worker.posted()).toEqual([{ id: 'r4', type: 'error', message: 'boom' }]);
		});

		it('falls back to a generic message when the thrown value has none', async () => {
			const request = { id: 'r5', get kind() { throw null; } };

			worker.send(request);
			await flush();

			expect(worker.posted()).toEqual([{ id: 'r5', type: 'error', message: 'unknown-error' }]);
		});
	});
});
