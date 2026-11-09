// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadDatasetFiles } from '../../../../src/features/datasetWorkspace/workflows/uploadDataset.js';
import { LARGE_FILE_WARNING_BYTES } from '../../../../src/config/limits.js';
import { setLocale, t } from '../../../../src/services/i18nService.js';
import { addDataset, getActiveDatasetIndex, getAllDatasets, replaceAllState } from '../../../../src/state/appState.js';
import { clearAllFeedback, showError } from '../../../../src/ui/feedback.js';
import { formatFileSize } from '../../../../src/utils/formatters.js';
import { restoreIngestWorker, useInProcessIngestWorker, useSilentIngestWorker } from '../../../helpers/ingestWorker.js';

// jsdom's FileReader finishes on setImmediate, so that timer stays real.
const TIMERS_TO_FAKE = ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'];

vi.mock('../../../../src/config/limits.js', async importOriginal => ({
	...(await importOriginal()),
	LARGE_DATASET_WARNING_ROWS: 2,
}));

/** A real File; `size` overrides the reported size without a large buffer. */
function fileOf(name, text, size) {
	const file = new File([text], name, { type: 'text/plain' });
	if (size !== undefined) Object.defineProperty(file, 'size', { value: size });
	return file;
}

// Spelled out so a parameter in the wrong slot fails the test.
const messages = {
	en: {
		largeFile: (name, size, limit) => `File "${name}" has size ${size}, above the recommended limit (${limit}). Continue anyway?`,
		largeRows: (name, rows, limit) => `File "${name}" has ${rows} rows, above the recommended limit (${limit}). Continue anyway?`,
		failed: name => `Could not load file "${name}". Please try again.`,
		failedDetail: (name, detail) => `Could not load file "${name}": ${detail}`,
	},
	'pt-BR': {
		largeFile: (name, size, limit) => `O arquivo "${name}" tem tamanho ${size}, acima do recomendado (${limit}). Deseja continuar?`,
		largeRows: (name, rows, limit) => `O arquivo "${name}" possui ${rows} linhas, acima do recomendado (${limit}). Deseja continuar?`,
		failed: name => `Não foi possível carregar o arquivo "${name}". Tente novamente.`,
		failedDetail: (name, detail) => `Não foi possível carregar o arquivo "${name}": ${detail}`,
	},
};

const notices = () => [...document.querySelectorAll('.error-notice > div')].map(node => node.textContent);
const failedToastLabel = () => document.querySelector('.toast-progress.failure .toast-progress-label')?.textContent;

describe.each(['en', 'pt-BR'])('file upload in %s', language => {
	let workerRequests;
	let confirm;
	const format = value => value.toLocaleString(language);
	const text = messages[language];

	beforeEach(async () => {
		vi.useFakeTimers({ toFake: TIMERS_TO_FAKE });
		document.body.replaceChildren();
		replaceAllState({ data: { datasets: [], activeIndex: -1 } });
		await setLocale(language);
		workerRequests = useInProcessIngestWorker();
		confirm = vi.fn(() => true);
	});
	afterEach(() => {
		clearAllFeedback();
		vi.runOnlyPendingTimers();
		vi.useRealTimers();
		vi.restoreAllMocks();
		restoreIngestWorker();
	});

	it('adds each file as a dataset named after it, with its size label', async () => {
		const csv = fileOf('sales.csv', 'region,amount\nNorth,10\n');
		const json = fileOf('people.json', '[{"name":"Ana","age":31}]');
		await uploadDatasetFiles([csv, json], { confirm });

		expect(getAllDatasets().map(({ name, sizeLabel, rows }) => ({ name, sizeLabel, rows }))).toEqual([
			{ name: 'sales.csv', sizeLabel: formatFileSize(csv.size), rows: [{ region: 'North', amount: 10 }] },
			{ name: 'people.json', sizeLabel: formatFileSize(json.size), rows: [{ name: 'Ana', age: 31 }] },
		]);
		expect(workerRequests.map(request => request.kind)).toEqual(['csv', 'json']);
		// The first file's toast stays in the DOM until its close timer runs.
		const lastToast = [...document.querySelectorAll('.toast-progress')].at(-1);
		expect(lastToast.classList.contains('success')).toBe(true);
		expect(lastToast.querySelector('.toast-progress-label').textContent).toBe(t('chive-progress-ready', ['people.json']));
		expect(notices()).toEqual([]);
		expect(confirm).not.toHaveBeenCalled();
	});

	it('does not select an upload while another dataset is active', async () => {
		addDataset({ name: 'first.csv', rows: [], columns: [] });
		await uploadDatasetFiles([fileOf('second.csv', 'v\n1\n')], { confirm });

		expect(getAllDatasets()).toHaveLength(2);
		expect(getActiveDatasetIndex()).toBe(0);
	});

	it('rejects an unsupported format with a notice and no toast, then keeps going', async () => {
		await uploadDatasetFiles([fileOf('notes.xyz', 'v\n1\n'), fileOf('good.csv', 'v\n1\n')], { confirm });

		expect(notices()).toEqual([t('chive-error-format', ['notes.xyz'])]);
		expect(getAllDatasets().map(dataset => dataset.name)).toEqual(['good.csv']);
	});

	it('asks before reading a file above the size warning threshold', async () => {
		const size = LARGE_FILE_WARNING_BYTES + 1;
		await uploadDatasetFiles([fileOf('huge.csv', 'v\n1\n', size)], { confirm });

		expect(confirm).toHaveBeenCalledExactlyOnceWith(
			text.largeFile('huge.csv', formatFileSize(size), formatFileSize(LARGE_FILE_WARNING_BYTES)),
		);
		expect(getAllDatasets().map(dataset => dataset.name)).toEqual(['huge.csv']);
	});

	it('stays quiet when the size warning is declined', async () => {
		confirm.mockReturnValue(false);
		await uploadDatasetFiles([fileOf('huge.csv', 'v\n1\n', LARGE_FILE_WARNING_BYTES + 1)], { confirm });

		expect(workerRequests).toEqual([]);
		expect(document.querySelector('#toast-progress')).toBeNull();
		expect(notices()).toEqual([]);
		expect(getAllDatasets()).toEqual([]);
	});

	it('asks above the row warning threshold and keeps every row it approves', async () => {
		const reads = vi.spyOn(FileReader.prototype, 'readAsText');
		await uploadDatasetFiles([fileOf('big.csv', 'v\n1\n2\n3\n')], { confirm }, { decimalSeparator: ',' });

		expect(confirm).toHaveBeenCalledExactlyOnceWith(text.largeRows('big.csv', format(3), format(2)));
		expect(workerRequests.map(request => request.options)).toEqual([
			{ decimalSeparator: ',', rowLimit: 2 },
			{ decimalSeparator: ',' },
		]);
		expect(getAllDatasets()[0].rows).toEqual([{ v: 1 }, { v: 2 }, { v: 3 }]);
		expect(reads).toHaveBeenCalledTimes(1);
	});

	it('closes quietly when the row warning is declined', async () => {
		confirm.mockReturnValue(false);
		await uploadDatasetFiles([fileOf('big.csv', 'v\n1\n2\n3\n')], { confirm });
		await vi.advanceTimersByTimeAsync(200);

		expect(workerRequests).toHaveLength(1);
		expect(document.querySelector('#toast-progress')).toBeNull();
		expect(notices()).toEqual([]);
		expect(getAllDatasets()).toEqual([]);
	});

	it('closes quietly when cancelled', async () => {
		const reached = useSilentIngestWorker();
		const upload = uploadDatasetFiles([fileOf('slow.csv', 'v\n1\n')], { confirm });
		await reached;
		document.querySelector('.toast-progress-cancel').click();
		await upload;
		await vi.advanceTimersByTimeAsync(200);

		expect(document.querySelector('#toast-progress')).toBeNull();
		expect(notices()).toEqual([]);
		expect(getAllDatasets()).toEqual([]);
	});

	it.each([
		{ separator: 'auto', name: 'measurements.csv', content: 'v\n6.000\n7.045\n', expected: [{ v: 6 }, { v: 7.045 }] },
		{ separator: ',', name: 'population.csv', content: 'v\n1.000\n1.234\n', expected: [{ v: 1000 }, { v: 1234 }] },
		{ separator: '.', name: 'population.csv', content: 'v\n"1,000"\n"2,000"\n', expected: [{ v: 1000 }, { v: 2000 }] },
		{ separator: 'auto', name: 'measurements.json', content: '[{"v":2.5},{"v":"1.000"}]', expected: [{ v: 2.5 }, { v: 1 }] },
		{ separator: ',', name: 'population.json', content: '[{"rate":2.5,"population":"1.000"}]', expected: [{ rate: 2.5, population: 1000 }] },
	])('reads $name with the $separator separator chosen for the batch', async ({ separator, name, content, expected }) => {
		await uploadDatasetFiles([fileOf(name, content)], { confirm }, { decimalSeparator: separator });

		expect(getAllDatasets()[0].rows).toEqual(expected);
		expect(workerRequests.map(request => request.options.decimalSeparator)).toEqual([separator]);
	});

	it.each([
		['empty.csv', '', 'chive-ingest-error-csv-empty'],
		['broken.json', '{broken', 'chive-ingest-error-json-syntax'],
	])('names %s with the parser detail in the toast and the notice', async (name, content, detailKey) => {
		await uploadDatasetFiles([fileOf(name, content)], { confirm });
		const message = text.failedDetail(name, t(detailKey));

		expect(notices()).toEqual([message]);
		expect(failedToastLabel()).toBe(message);
		expect(getAllDatasets()).toEqual([]);
	});

	it('names a file it cannot read', async () => {
		vi.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function () {
			queueMicrotask(() => this.onerror?.(new Event('error')));
		});
		await uploadDatasetFiles([fileOf('locked.csv', 'v\n1\n')], { confirm });
		const message = text.failed('locked.csv');

		expect(notices()).toEqual([message]);
		expect(failedToastLabel()).toBe(message);
		expect(workerRequests).toEqual([]);
	});

	it('names the file when its size warning cannot open', async () => {
		confirm.mockImplementation(() => { throw new Error('private-detail'); });
		await uploadDatasetFiles([fileOf('huge.csv', 'v\n1\n', LARGE_FILE_WARNING_BYTES + 1), fileOf('next.csv', 'v\n1\n')], { confirm });

		expect(notices()).toEqual([text.failed('huge.csv')]);
		expect(document.body.textContent).not.toContain('private-detail');
		expect(getAllDatasets().map(dataset => dataset.name)).toEqual(['next.csv']);
	});

	it('clears earlier notices once per batch and reports every failure in it', async () => {
		showError('earlier notice');
		await uploadDatasetFiles([fileOf('a.xyz', ''), fileOf('b.xyz', '')], { confirm });

		expect(notices()).toEqual([t('chive-error-format', ['a.xyz']), t('chive-error-format', ['b.xyz'])]);
	});

	it('ignores an empty selection without clearing notices', async () => {
		showError('earlier notice');
		await uploadDatasetFiles(null, { confirm });
		await uploadDatasetFiles([], { confirm });

		expect(notices()).toEqual(['earlier notice']);
		expect(getAllDatasets()).toEqual([]);
	});
});
