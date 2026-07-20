// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { chunkedNormalize, runIngest } from '../../src/workers/dataIngestWorker.js';

describe('chunkedNormalize', () => {
	it('converts numeric cells based on column types', () => {
		const rows = [
			{ a: '1.5', b: 'hello' },
			{ a: '2.5', b: 'world' },
		];
		const columns = [
			{ name: 'a', type: 'number' },
			{ name: 'b', type: 'text' },
		];
		const out = chunkedNormalize(rows, columns, '.');
		expect(out).toEqual([
			{ a: 1.5, b: 'hello' },
			{ a: 2.5, b: 'world' },
		]);
	});

	it('handles comma decimal separator', () => {
		const rows = [{ a: '1,5' }];
		const columns = [{ name: 'a', type: 'number' }];
		expect(chunkedNormalize(rows, columns, ',')).toEqual([{ a: 1.5 }]);
	});

	it('preserves null/empty/undefined numeric cells without coercing them', () => {
		const rows = [
			{ a: '', b: null },
			{ a: '5', b: undefined },
		];
		const columns = [
			{ name: 'a', type: 'number' },
			{ name: 'b', type: 'text' },
		];
		const out = chunkedNormalize(rows, columns, '.');
		expect(out[0]).toEqual({ a: '', b: null });
		expect(out[1]).toEqual({ a: 5, b: undefined });
	});

	it('parses date columns into Date instances and null for invalid', () => {
		const rows = [
			{ d: '2024-01-15' },
			{ d: 'not-a-date' },
			{ d: '' },
		];
		const columns = [{ name: 'd', type: 'date' }];
		const out = chunkedNormalize(rows, columns, '.');
		expect(out[0].d).toBeInstanceOf(Date);
		expect(out[0].d.getUTCFullYear()).toBe(2024);
		expect(out[1].d).toBeNull();
		expect(out[2].d).toBe('');
	});

	it('invokes onChunk between batches with running counts', () => {
		const rows = Array.from({ length: 50 }, (_, i) => ({ a: String(i) }));
		const columns = [{ name: 'a', type: 'number' }];
		const onChunk = vi.fn();
		chunkedNormalize(rows, columns, '.', onChunk, 20);
		expect(onChunk).toHaveBeenCalledTimes(3);
		expect(onChunk.mock.calls[0]).toEqual([20, 50]);
		expect(onChunk.mock.calls[1]).toEqual([40, 50]);
		expect(onChunk.mock.calls[2]).toEqual([50, 50]);
	});
});

describe('runIngest', () => {
	function collectMessages() {
		const msgs = [];
		return { post: (m) => msgs.push(m), msgs };
	}

	it('emits progress messages and a final done with parsed/typed/normalized rows', () => {
		const { post, msgs } = collectMessages();
		runIngest({ id: 'test', kind: 'csv', text: 'a,b\n1,2\n3,4\n' }, post);

		const types = msgs.map(m => m.type);
		expect(types.filter(t => t === 'progress').length).toBeGreaterThan(0);

		const done = msgs.find(m => m.type === 'done');
		expect(done).toBeTruthy();
		expect(done.result.rows).toEqual([
			{ a: 1, b: 2 },
			{ a: 3, b: 4 },
		]);
		expect(done.result.columns.map(c => c.name)).toEqual(['a', 'b']);
		expect(done.result.statsNumeric.length).toBe(2);
		expect(done.result.truncatedFrom).toBeNull();
	});

	it('caps a threshold-probe response and reports the original length', () => {
		const { post, msgs } = collectMessages();
		const csv = 'a\n' + Array.from({ length: 100 }, (_, i) => i).join('\n') + '\n';
		runIngest({ id: 'test', kind: 'csv', text: csv, options: { rowLimit: 10 } }, post);

		const done = msgs.find(m => m.type === 'done');
		expect(done.result.rows).toHaveLength(10);
		expect(done.result.truncatedFrom).toBe(100);
	});

	it('drops columns named in options.dropColumns before type detection', () => {
		const { post, msgs } = collectMessages();
		runIngest(
			{ id: 'test', kind: 'csv', text: 'a,b,c\n1,2,3\n', options: { dropColumns: ['b'] } },
			post,
		);
		const done = msgs.find(m => m.type === 'done');
		expect(done.result.columns.map(c => c.name)).toEqual(['a', 'c']);
		expect(done.result.rows).toEqual([{ a: 1, c: 3 }]);
	});

	it('parses JSON arrays', () => {
		const { post, msgs } = collectMessages();
		runIngest({ id: 'test', kind: 'json', text: '[{"a":1},{"a":2}]' }, post);
		const done = msgs.find(m => m.type === 'done');
		expect(done.result.rows).toEqual([{ a: 1 }, { a: 2 }]);
	});

	it('joins and normalizes complete row sets in the worker pipeline', () => {
		const { post, msgs } = collectMessages();
		runIngest({
			id: 'join-test',
			kind: 'join',
			join: {
				leftRows: [
					{ id: '1', amount: '10' },
					{ id: '2', amount: '20' },
				],
				rightRows: [
					{ id: '1', target: '99' },
					{ id: '2', target: '88' },
				],
				leftKeys: ['id'],
				rightKeys: ['id'],
				joinType: 'inner',
				leftColumns: ['id', 'amount'],
				rightColumns: ['target'],
				leftDatasetName: 'left.csv',
				rightDatasetName: 'right.csv',
			},
		}, post);

		expect(msgs[0]).toEqual({
			id: 'join-test',
			type: 'progress',
			stage: 'joining',
			percent: 0,
		});
		const done = msgs.find(message => message.type === 'done');
		expect(done.result.rows).toEqual([
			{ id: 1, amount: 10, target: 99 },
			{ id: 2, amount: 20, target: 88 },
		]);
		expect(done.result.outputColumns).toEqual(['id', 'amount', 'target']);
		expect(done.result.truncatedFrom).toBeNull();
	});

	it('progress percentages are non-decreasing and reach 100 by the final message', () => {
		const { post, msgs } = collectMessages();
		const csv = 'a,b\n' + Array.from({ length: 30 }, (_, i) => `${i},${i * 2}`).join('\n') + '\n';
		runIngest({ id: 't', kind: 'csv', text: csv }, post);

		const percents = msgs.filter(m => m.type === 'progress').map(m => m.percent);
		for (let i = 1; i < percents.length; i++) {
			expect(percents[i]).toBeGreaterThanOrEqual(percents[i - 1]);
		}
		expect(percents[percents.length - 1]).toBe(100);
	});

	it('posts an error message with the parser reason when the CSV is empty', () => {
		const { post, msgs } = collectMessages();
		runIngest({ id: 't', kind: 'csv', text: '' }, post);
		expect(msgs).toContainEqual({ id: 't', type: 'error', reason: 'csv-empty' });
		expect(msgs.some(m => m.type === 'done')).toBe(false);
	});
});
