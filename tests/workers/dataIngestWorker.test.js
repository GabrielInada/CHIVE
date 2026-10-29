// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { ingestDataset } from '../../src/domain/datasets/ingest.js';
import { runIngest } from '../../src/workers/dataIngestWorker.js';

describe('runIngest', () => {
	function collectMessages() {
		const msgs = [];
		return { post: (m) => msgs.push(m), msgs };
	}

	it('posts each progress tick and then the result, all under the request id', () => {
		const request = { kind: 'csv', text: 'a,b\n1,2\n3,4\n', options: { rowLimit: 1 } };
		const progress = [];
		const expected = ingestDataset(request, { onProgress: tick => progress.push(tick) });
		const { post, msgs } = collectMessages();

		runIngest({ id: 'test', ...request }, post);

		expect(expected.value.truncatedFrom).toBe(2);
		expect(msgs).toEqual([
			...progress.map(({ stage, percent }) => ({ id: 'test', type: 'progress', stage, percent })),
			{ id: 'test', type: 'done', result: expected.value },
		]);
	});

	it('posts an error message with the reason when ingest fails', () => {
		const { post, msgs } = collectMessages();
		runIngest({ id: 't', kind: 'csv', text: '' }, post);
		expect(msgs).toEqual([
			{ id: 't', type: 'progress', stage: 'parsing', percent: 0 },
			{ id: 't', type: 'error', reason: 'csv-empty' },
		]);
	});
});
