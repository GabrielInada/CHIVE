// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	getLoadedDatasets,
	handleFileUpload,
	handleJoinDatasetRequest,
	handleSampleDatasetRequest,
	initDatasetController,
	removeDatasetByIndex,
	selectDataset,
	setupFileInputListeners,
} from '../../../src/features/datasetWorkspace/datasetController.js';
import { FILE_IDS } from '../../../src/features/datasetWorkspace/domIds.js';
import { LARGE_FILE_WARNING_BYTES } from '../../../src/config/limits.js';
import { SAMPLE_DATASET_CATALOG } from '../../../src/data/sampleDatasetCatalog.js';
import { setLocale, t } from '../../../src/services/i18nService.js';
import { addDataset, applyStateSnapshot, getActiveDatasetIndex, getAllDatasets } from '../../../src/state/appState.js';
import { clearAllFeedback } from '../../../src/ui/feedback.js';
import { restoreIngestWorker, useInProcessIngestWorker } from '../../helpers/ingestWorker.js';

// jsdom's FileReader finishes on setImmediate, so that timer stays real.
const TIMERS_TO_FAKE = ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'];

const notices = () => [...document.querySelectorAll('.error-notice > div')].map(node => node.textContent);

function addTextDataset(name, ids = ['a']) {
	return addDataset({ name, rows: ids.map(id => ({ id })), columns: [{ name: 'id', type: 'text' }] });
}

function mountUploadControls() {
	const input = document.createElement('input');
	input.id = FILE_IDS.fileInput;
	input.type = 'file';
	const zone = document.createElement('div');
	zone.id = FILE_IDS.uploadZone;
	document.body.append(input, zone);
	return { input, zone };
}

describe('datasetController', () => {
	let confirm;

	beforeEach(async () => {
		vi.useFakeTimers({ toFake: TIMERS_TO_FAKE });
		document.body.replaceChildren();
		applyStateSnapshot({ data: { datasets: [], activeIndex: -1 } });
		await setLocale('en');
		useInProcessIngestWorker();
		confirm = vi.fn(() => true);
		initDatasetController({ confirmCallback: confirm });
	});
	afterEach(() => {
		clearAllFeedback();
		vi.runOnlyPendingTimers();
		vi.useRealTimers();
		vi.restoreAllMocks();
		restoreIngestWorker();
	});

	it('selects and removes datasets, reporting an index that does not exist', () => {
		addTextDataset('A.csv');
		addTextDataset('B.csv');

		selectDataset(1);
		expect(getActiveDatasetIndex()).toBe(1);
		removeDatasetByIndex(0);
		expect(getAllDatasets().map(dataset => dataset.name)).toEqual(['B.csv']);
		selectDataset(5);
		removeDatasetByIndex(5);

		expect(notices()).toEqual(['Invalid dataset index: 5', 'Invalid dataset index: 5']);
		expect(getLoadedDatasets()).toBe(getAllDatasets());
	});

	it('reports missing upload controls', () => {
		setupFileInputListeners();

		expect(notices()).toEqual([t('chive-error-upload-input-missing'), t('chive-error-upload-zone-missing')]);
	});

	it('opens the file picker from the upload zone and marks drag hover', () => {
		const { input, zone } = mountUploadControls();
		const openPicker = vi.spyOn(input, 'click').mockImplementation(() => {});
		setupFileInputListeners();

		zone.click();
		zone.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
		expect(zone.classList.contains('hover')).toBe(true);
		zone.dispatchEvent(new Event('dragleave', { bubbles: true }));

		expect(openPicker).toHaveBeenCalledTimes(1);
		expect(zone.classList.contains('hover')).toBe(false);
	});

	it('uploads dropped files', async () => {
		const { zone } = mountUploadControls();
		setupFileInputListeners();
		const drop = new Event('drop', { bubbles: true, cancelable: true });
		Object.defineProperty(drop, 'dataTransfer', { value: { files: [new File(['v\n1\n'], 'dropped.csv')] } });

		zone.dispatchEvent(drop);
		await vi.waitFor(() => expect(getAllDatasets()).toHaveLength(1));

		expect(getAllDatasets()[0].name).toBe('dropped.csv');
		expect(zone.classList.contains('hover')).toBe(false);
	});

	it('clears the file input after each upload so the same file can be chosen again', async () => {
		const { input } = mountUploadControls();
		let value = '';
		Object.defineProperty(input, 'value', { get: () => value, set: next => { value = next; } });
		Object.defineProperty(input, 'files', { value: [new File(['v\n1\n'], 'rows.csv')] });
		setupFileInputListeners();

		for (let upload = 1; upload <= 2; upload++) {
			value = 'C:\\fakepath\\rows.csv';
			input.dispatchEvent(new Event('change'));
			await vi.waitFor(() => expect(getAllDatasets()).toHaveLength(upload));
			await vi.waitFor(() => expect(value).toBe(''));
		}
		expect(getAllDatasets().map(dataset => dataset.name)).toEqual(['rows.csv', 'rows.csv']);
	});

	it('reads files with the decimal separator chosen in the upload controls', async () => {
		const select = document.createElement('select');
		select.id = FILE_IDS.decimalSeparator;
		select.innerHTML = '<option value="auto">Auto</option><option value=",">Comma</option>';
		select.value = ',';
		document.body.append(select);

		await handleFileUpload([new File(['v\n1.000\n'], 'population.csv')]);

		expect(getAllDatasets()[0].rows).toEqual([{ v: 1000 }]);
	});

	it('asks the injected confirmation instead of opening the large-data dialog', async () => {
		confirm.mockReturnValue(false);
		const file = new File(['v\n1\n'], 'huge.csv');
		Object.defineProperty(file, 'size', { value: LARGE_FILE_WARNING_BYTES + 1 });

		await handleFileUpload([file]);

		expect(confirm).toHaveBeenCalledTimes(1);
		expect(document.querySelector('dialog')).toBeNull();
		expect(getAllDatasets()).toEqual([]);
	});

	it('selects a joined dataset', async () => {
		addTextDataset('A.csv', ['a', 'b']);
		addTextDataset('B.csv', ['a']);

		await handleJoinDatasetRequest({
			leftIndex: 0,
			rightIndex: 1,
			leftKeys: ['id'],
			rightKeys: ['id'],
			leftColumns: ['id'],
			rightColumns: [],
		});

		expect(getAllDatasets()).toHaveLength(3);
		expect(getAllDatasets()[2].rows).toEqual([{ id: 'a' }]);
		expect(getActiveDatasetIndex()).toBe(2);
	});

	it.each(SAMPLE_DATASET_CATALOG)('loads and selects the bundled $id sample dataset', async sampleDataset => {
		addTextDataset('A.csv');

		const result = await handleSampleDatasetRequest(sampleDataset);

		expect(result.ok).toBe(true);
		expect(getAllDatasets()).toHaveLength(2);
		expect(getAllDatasets()[1].name).toBe(t(sampleDataset.nameKey));
		expect(getAllDatasets()[1].rows).toHaveLength(sampleDataset.rowCount);
		expect(getAllDatasets()[1].columns).toHaveLength(sampleDataset.columnCount);
		expect(getAllDatasets()[1].sizeLabel).toBe(t('chive-sample-dataset-generated-size', sampleDataset.rowCount));
		expect(getActiveDatasetIndex()).toBe(1);
		expect(notices()).toEqual([]);
	});
});
