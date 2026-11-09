// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runIntake } from '../../../../src/features/datasetWorkspace/workflows/intake.js';
import { createDefaultChartConfig } from '../../../../src/config/charts/defaults.js';
import { STATS_CATEGORICAL_VERSION, STATS_NUMERIC_VERSION } from '../../../../src/config/statistics.js';
import { ingestFile } from '../../../../src/services/dataIngestService.js';
import { setLocale, t } from '../../../../src/services/i18nService.js';
import { applyStateSnapshot, getActiveDatasetIndex, getAllDatasets } from '../../../../src/state/appState.js';
import { clearAllFeedback } from '../../../../src/ui/feedback.js';
import { fail } from '../../../../src/utils/result.js';
import { restoreIngestWorker, useInProcessIngestWorker, useSilentIngestWorker } from '../../../helpers/ingestWorker.js';

vi.mock('../../../../src/config/limits.js', async importOriginal => ({
	...(await importOriginal()),
	LARGE_DATASET_WARNING_ROWS: 1000,
}));

/** A one-column CSV with `count` rows. */
function csvOf(count) {
	return `value\n${Array.from({ length: count }, (_, index) => index + 1).join('\n')}\n`;
}

/**
 * A source over CSV text that runs the real Ingest through the worker.
 * A capped source passes the row limit on, as a file does; an uncapped one
 * ignores it, as a join does.
 */
function csvSource(text, { capped = true, ...overrides } = {}) {
	const requests = [];
	return {
		requests,
		name: 'numbers.csv',
		progressLabel: 'Starting numbers.csv',
		sizeLabel: rowCount => `${rowCount} rows`,
		ingest(request) {
			requests.push(request);
			const options = capped && request.rowLimit !== undefined ? { rowLimit: request.rowLimit } : {};
			return ingestFile({ kind: 'csv', text, options }, request);
		},
		rowWarning: (rowCount, rowLimit) => `numbers.csv has ${rowCount} rows, above ${rowLimit}.`,
		successMessage: 'numbers.csv is ready.',
		failureMessage: vi.fn(detail => (detail ? `numbers.csv failed: ${detail}` : 'numbers.csv failed.')),
		...overrides,
	};
}

/** A source that waits for its signal, then settles with `onAbort()`. */
function sourceUntilCancelled(onAbort) {
	return csvSource('', {
		ingest: ({ signal }) => new Promise((resolve, reject) => {
			signal.addEventListener('abort', () => onAbort(resolve, reject), { once: true });
		}),
	});
}

const notices = () => [...document.querySelectorAll('.error-notice > div')].map(node => node.textContent);
const toastLabel = () => document.querySelector('#toast-progress .toast-progress-label')?.textContent;
const failedToastLabel = () => document.querySelector('.toast-progress.failure .toast-progress-label')?.textContent;
const clickCancel = () => document.querySelector('.toast-progress-cancel').click();

describe.each(['en', 'pt-BR'])('dataset intake in %s', language => {
	let workerRequests;
	const format = value => value.toLocaleString(language);

	beforeEach(async () => {
		vi.useFakeTimers();
		document.body.replaceChildren();
		applyStateSnapshot({ data: { datasets: [], activeIndex: -1 } });
		await setLocale(language);
		workerRequests = useInProcessIngestWorker();
	});
	afterEach(() => {
		clearAllFeedback();
		vi.runOnlyPendingTimers();
		vi.useRealTimers();
		vi.restoreAllMocks();
		restoreIngestWorker();
	});

	async function expectQuietCancel(run) {
		expect(await run).toEqual({ ok: false, reason: 'cancelled' });
		await vi.advanceTimersByTimeAsync(200);
		expect(document.querySelector('#toast-progress')).toBeNull();
		expect(notices()).toEqual([]);
		expect(getAllDatasets()).toEqual([]);
	}

	it('adds the dataset a source ingests, selects it and ends on the success message', async () => {
		const selectDataset = vi.fn();
		const result = await runIntake(csvSource('value\n1\n2\n'), { selectDataset });

		expect(result).toEqual({ ok: true, index: 0 });
		expect(getAllDatasets()).toEqual([{
			id: expect.any(String),
			name: 'numbers.csv',
			sizeLabel: '2 rows',
			rows: [{ value: 1 }, { value: 2 }],
			columns: [expect.objectContaining({ name: 'value', type: 'number' })],
			selectedColumns: ['value'],
			chartConfig: createDefaultChartConfig(),
			precomputedStats: expect.objectContaining({
				numeric: [expect.objectContaining({ name: 'value', n: 2 })],
				numericVersion: STATS_NUMERIC_VERSION,
				categoricalVersion: STATS_CATEGORICAL_VERSION,
			}),
		}]);
		expect(selectDataset).toHaveBeenCalledExactlyOnceWith(0);
		expect(document.querySelector('.toast-progress.success .toast-progress-label')?.textContent).toBe('numbers.csv is ready.');
		expect(notices()).toEqual([]);
	});

	it('leaves the active dataset alone when nothing selects the new one', async () => {
		await runIntake(csvSource('value\n1\n'));
		await runIntake(csvSource('value\n2\n', { name: 'second.csv' }));

		expect(getAllDatasets().map(dataset => dataset.name)).toEqual(['numbers.csv', 'second.csv']);
		expect(getActiveDatasetIndex()).toBe(0);
	});

	it('starts on the source label, then names each worker stage', async () => {
		let report;
		const source = csvSource('', {
			ingest: ({ signal, onProgress }) => new Promise(resolve => {
				report = onProgress;
				signal.addEventListener('abort', () => resolve(fail('cancelled')), { once: true });
			}),
		});
		const run = runIntake(source);

		expect(toastLabel()).toBe('Starting numbers.csv');
		report({ stage: 'parsing', percent: 10 });
		expect(toastLabel()).toBe(t('chive-progress-parsing', ['numbers.csv']));
		report({ stage: 'stats', percent: 90 });
		expect(toastLabel()).toBe(t('chive-progress-computing-stats'));
		expect(document.querySelector('.toast-progress-percent').textContent).toBe('90%');
		clickCancel();
		await expectQuietCancel(run);
	});

	it('closes quietly when cancelled while the worker runs', async () => {
		const reached = useSilentIngestWorker();
		const selectDataset = vi.fn();
		const run = runIntake(csvSource('value\n1\n'), { selectDataset });
		await reached;
		clickCancel();

		await expectQuietCancel(run);
		expect(selectDataset).not.toHaveBeenCalled();
	});

	it('closes quietly when a source throws because it was cancelled', async () => {
		const source = sourceUntilCancelled((resolve, reject) => reject(new Error('aborted')));
		const run = runIntake(source);
		clickCancel();

		await expectQuietCancel(run);
		expect(source.failureMessage).not.toHaveBeenCalled();
	});

	it('asks before keeping more rows than the limit, then runs a capped source again without the cap', async () => {
		const confirm = vi.fn(() => true);
		const source = csvSource(csvOf(1001));
		const result = await runIntake(source, { confirm });

		expect(result).toEqual({ ok: true, index: 0 });
		expect(confirm).toHaveBeenCalledExactlyOnceWith(`numbers.csv has ${format(1001)} rows, above ${format(1000)}.`);
		expect(source.requests.map(request => request.rowLimit)).toEqual([1000, undefined]);
		expect(workerRequests.map(request => request.options.rowLimit)).toEqual([1000, undefined]);
		expect(getAllDatasets()[0].rows).toHaveLength(1001);
		expect(getAllDatasets()[0].sizeLabel).toBe('1001 rows');
	});

	it('checks a source that cannot cap after its complete run and never runs it again', async () => {
		const confirm = vi.fn(() => true);
		await runIntake(csvSource(csvOf(1001), { capped: false }), { confirm });

		expect(confirm).toHaveBeenCalledExactlyOnceWith(`numbers.csv has ${format(1001)} rows, above ${format(1000)}.`);
		expect(workerRequests).toHaveLength(1);
		expect(getAllDatasets()[0].rows).toHaveLength(1001);
	});

	it('keeps a capped pass at the limit without asking', async () => {
		const confirm = vi.fn(() => true);
		const source = csvSource(csvOf(1000));
		await runIntake(source, { confirm });

		expect(confirm).not.toHaveBeenCalled();
		expect(source.requests.map(request => request.rowLimit)).toEqual([1000]);
		expect(getAllDatasets()[0].rows).toHaveLength(1000);
	});

	it('never limits a source without a row warning', async () => {
		const confirm = vi.fn(() => true);
		const source = csvSource(csvOf(1001), { rowWarning: null });
		await runIntake(source, { confirm });

		expect(confirm).not.toHaveBeenCalled();
		expect(source.requests.map(request => Object.hasOwn(request, 'rowLimit'))).toEqual([false]);
		expect(getAllDatasets()[0].rows).toHaveLength(1001);
	});

	it('closes quietly when the row warning is declined', async () => {
		const source = csvSource(csvOf(1001));
		await expectQuietCancel(runIntake(source, { confirm: () => false }));
		expect(source.requests).toHaveLength(1);
	});

	it('declines the row warning itself when nothing can confirm it', async () => {
		await expectQuietCancel(runIntake(csvSource(csvOf(1001))));
	});

	it('closes quietly when cancelled during the uncapped run', async () => {
		let askedAbout;
		const asked = new Promise(resolve => { askedAbout = resolve; });
		const confirm = () => {
			askedAbout(useSilentIngestWorker());
			return true;
		};
		const run = runIntake(csvSource(csvOf(1001)), { confirm });
		await asked;
		clickCancel();

		await expectQuietCancel(run);
	});

	it('names the source with the translated Ingest detail in the toast and the notice', async () => {
		const source = csvSource('');
		const result = await runIntake(source);
		const message = `numbers.csv failed: ${t('chive-ingest-error-csv-empty')}`;

		expect(result).toEqual({ ok: false, reason: 'csv-empty' });
		expect(source.failureMessage).toHaveBeenCalledExactlyOnceWith(t('chive-ingest-error-csv-empty'), 'csv-empty');
		expect(notices()).toEqual([message]);
		expect(failedToastLabel()).toBe(message);
		expect(getAllDatasets()).toEqual([]);
	});

	it('gives an unknown failure no detail, so its reason code stays off the page', async () => {
		const source = csvSource('', { ingest: async () => fail('worker-timeout') });

		expect(await runIntake(source)).toEqual({ ok: false, reason: 'worker-timeout' });
		expect(source.failureMessage).toHaveBeenCalledExactlyOnceWith('', 'worker-timeout');
		expect(notices()).toEqual(['numbers.csv failed.']);
		expect(failedToastLabel()).toBe('numbers.csv failed.');
		expect(document.body.textContent).not.toContain('worker-timeout');
	});

	it('reports a failure in the uncapped run after the warning was approved', async () => {
		const source = csvSource(csvOf(1001));
		const capped = source.ingest;
		source.ingest = request => (request.rowLimit === undefined ? Promise.resolve(fail('worker-timeout')) : capped(request));

		expect(await runIntake(source, { confirm: () => true })).toEqual({ ok: false, reason: 'worker-timeout' });
		expect(notices()).toEqual(['numbers.csv failed.']);
		expect(getAllDatasets()).toEqual([]);
	});

	it('reports a source that throws without its exception text', async () => {
		const source = csvSource('', { ingest: () => { throw new Error('private-detail'); } });

		expect(await runIntake(source)).toEqual({ ok: false, reason: 'intake-error' });
		expect(source.failureMessage).toHaveBeenCalledExactlyOnceWith('', 'intake-error');
		expect(notices()).toEqual(['numbers.csv failed.']);
		expect(failedToastLabel()).toBe('numbers.csv failed.');
		expect(document.body.textContent).not.toContain('private-detail');
	});
});
