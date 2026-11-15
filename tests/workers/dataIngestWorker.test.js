// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { ingestDataset } from '../../src/domain/datasets/ingest.js';
import { runIngest } from '../../src/workers/dataIngestWorker.js';

describe('runIngest', () => {
	function collectMessages() {
		const msgs = [];
		return { post: (m) => msgs.push(m), msgs };
	}

	it('posts each progress tick and then the result, all under the request id', () => {
		const request = { kind: 'csv', text: 'a,b\n1,2\n3,4\n' };
		const progress = [];
		const expected = ingestDataset(request, { onProgress: tick => progress.push(tick) });
		const { post, msgs } = collectMessages();

		runIngest({ id: 'test', ...request }, post);

		expect(msgs.some(message => message.type === 'row-count')).toBe(false);
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

	it('stops after parsing to post the counts when asked, and finishes only once told to continue', async () => {
		const request = { kind: 'csv', text: 'a,b,c\n1,2,3\n4,5,6\n' };
		const progress = [];
		const expected = ingestDataset(request, { onProgress: tick => progress.push(tick) });
		const { post, msgs } = collectMessages();
		let resume;
		const continueIngest = vi.fn(() => new Promise(resolve => { resume = resolve; }));

		const run = runIngest({ id: 'w', ...request, options: { awaitRowCount: true } }, post, continueIngest);

		expect(msgs).toEqual([
			{ id: 'w', type: 'progress', stage: 'parsing', percent: 0 },
			{ id: 'w', type: 'progress', stage: 'parsing', percent: 30 },
			{ id: 'w', type: 'row-count', rowCount: 2, columnCount: 3 },
		]);
		expect(continueIngest).toHaveBeenCalledTimes(1);

		resume();
		await run;
		expect(msgs.filter(message => message.type !== 'row-count')).toEqual([
			...progress.map(({ stage, percent }) => ({ id: 'w', type: 'progress', stage, percent })),
			{ id: 'w', type: 'done', result: expected.value },
		]);
	});

	it('reports a parse failure without asking about the counts', async () => {
		const { post, msgs } = collectMessages();
		const continueIngest = vi.fn();
		await runIngest({ id: 'e', kind: 'json', text: '{broken', options: { awaitRowCount: true } }, post, continueIngest);

		expect(msgs).toEqual([
			{ id: 'e', type: 'progress', stage: 'parsing', percent: 0 },
			{ id: 'e', type: 'error', reason: 'json-syntax' },
		]);
		expect(continueIngest).not.toHaveBeenCalled();
	});
});
