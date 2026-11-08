// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPresetDataset } from '../../../../src/features/datasetWorkspace/workflows/loadPresetDataset.js';
import { __setIngestWorkerFactoryForTesting } from '../../../../src/services/dataIngestService.js';
import { setLocale, t } from '../../../../src/services/i18nService.js';
import { getAllDatasets, replaceAllState } from '../../../../src/state/appState.js';
import { clearAllFeedback } from '../../../../src/ui/feedback.js';
import { runIngest } from '../../../../src/workers/dataIngestWorker.js';

vi.mock('../../../../src/config/limits.js', async importOriginal => ({
	...(await importOriginal()),
	ROW_LIMIT: 1,
}));

const preset = { nameKey: 'chive-preset-iris-name', rows: 1, dataUrl: '/iris.csv', dataFormat: 'csv' };
const namedFailure = {
	en: 'Could not load sample dataset "Iris". Please try again.',
	'pt-BR': 'Não foi possível carregar o dataset de exemplo "Iris". Tente novamente.',
};
const unnamedFailure = {
	en: 'Could not load the sample dataset. Please try again.',
	'pt-BR': 'Não foi possível carregar o dataset de exemplo. Tente novamente.',
};
function pendingFetch() {
	return vi.fn((url, { signal }) => new Promise((resolve, reject) => {
		signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
	}));
}

describe.each(['en', 'pt-BR'])('sample loading feedback in %s', language => {
	let selectDataset;
	let fetchSource;
	beforeEach(async () => {
		vi.useFakeTimers();
		document.body.replaceChildren();
		replaceAllState({ data: { datasets: [], activeDatasetIndex: -1 } });
		await setLocale(language);
		selectDataset = vi.fn();
		fetchSource = vi.fn().mockResolvedValue({ ok: true, text: async () => 'value\n1\n' });
		vi.stubGlobal('fetch', fetchSource);
		__setIngestWorkerFactoryForTesting(() => ({
			postMessage(payload) {
				queueMicrotask(() => runIngest(payload, message => this.onmessage({ data: message })));
			},
			terminate() {},
		}));
	});
	afterEach(() => {
		clearAllFeedback();
		vi.runOnlyPendingTimers();
		vi.useRealTimers();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		__setIngestWorkerFactoryForTesting(null);
	});
	function expectFailure(message) {
		expect(document.querySelector('.error-notice > div')?.textContent).toBe(message);
		expect(document.querySelector('.toast-progress.failure .toast-progress-label')?.textContent).toBe(message);
		expect(document.body.textContent).not.toMatch(/chive-|preset-fetch|worker-error|private-detail|Upload failed|joined file|arquivo unido/);
		expect(getAllDatasets()).toEqual([]);
		expect(selectDataset).not.toHaveBeenCalled();
	}

	it('reports a network failure without exposing its reason code', async () => {
		fetchSource.mockRejectedValue(new Error('private-detail'));
		await loadPresetDataset(preset, { selectDataset });
		expectFailure(namedFailure[language]);
	});
	it.each([404, 503])('reports HTTP %s as a sample-load failure', async status => {
		fetchSource.mockResolvedValue({ ok: false, status });
		await loadPresetDataset(preset, { selectDataset });
		expectFailure(namedFailure[language]);
	});
	it('reports a missing data URL without a diagnostic code', async () => {
		await loadPresetDataset({ ...preset, dataUrl: '' }, { selectDataset });
		expectFailure(namedFailure[language]);
		expect(fetchSource).not.toHaveBeenCalled();
	});
	it('uses the timeout explanation in both feedback surfaces', async () => {
		const timeout = new AbortController();
		vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal);
		vi.stubGlobal('fetch', pendingFetch());
		const operation = loadPresetDataset(preset, { selectDataset });
		timeout.abort();
		await operation;
		expectFailure(t('chive-preset-fetch-timeout', ['Iris']));
	});
	it.each([
		['csv', '', 'chive-ingest-error-csv-empty'],
		['json', '{broken', 'chive-ingest-error-json-syntax'],
	])('retains translated %s parsing details through the real ingest pipeline', async (dataFormat, text, key) => {
		fetchSource.mockResolvedValue({ ok: true, text: async () => text });
		await loadPresetDataset({ ...preset, dataFormat }, { selectDataset });
		const prefix = language === 'en' ? 'Could not load sample dataset "Iris": ' : 'Não foi possível carregar o dataset de exemplo "Iris": ';
		expectFailure(prefix + t(key));
	});
	it('uses a safe fallback for an unknown worker failure', async () => {
		__setIngestWorkerFactoryForTesting(() => ({
			postMessage({ id }) {
				queueMicrotask(() => this.onmessage({ data: { id, type: 'error', reason: 'worker-error-private-detail' } }));
			},
			terminate() {},
		}));
		await loadPresetDataset(preset, { selectDataset });
		expectFailure(namedFailure[language]);
	});
	it('hides unexpected exception text', async () => {
		await loadPresetDataset({ ...preset, get dropColumns() { throw new Error('private-detail'); } }, { selectDataset });
		expectFailure(namedFailure[language]);
	});
	it('reports a missing preset without creating a progress toast', async () => {
		await loadPresetDataset(null, { selectDataset });
		expect(document.querySelector('.error-notice > div')?.textContent).toBe(unnamedFailure[language]);
		expect(document.querySelector('#toast-progress')).toBeNull();
		expect(fetchSource).not.toHaveBeenCalled();
		expect(getAllDatasets()).toEqual([]);
	});
	it.each(['fetch', 'ingest'])('cancels %s quietly without adding a dataset', async stage => {
		let started;
		const ready = new Promise(resolve => { started = resolve; });
		if (stage === 'fetch') {
			vi.stubGlobal('fetch', pendingFetch());
			started();
		} else {
			__setIngestWorkerFactoryForTesting(() => ({ postMessage() { started(); }, terminate() {} }));
		}
		const operation = loadPresetDataset(preset, { selectDataset });
		await ready;
		document.querySelector('.toast-progress-cancel').click();
		await operation;
		await vi.advanceTimersByTimeAsync(200);
		expect(document.querySelector('.error-notice')).toBeNull();
		expect(document.querySelector('#toast-progress')).toBeNull();
		expect(getAllDatasets()).toEqual([]);
		expect(selectDataset).not.toHaveBeenCalled();
	});
	it('adds a sample above the row limit without asking', async () => {
		fetchSource.mockResolvedValue({ ok: true, text: async () => 'value\n1\n2\n' });
		await loadPresetDataset(preset, { selectDataset });
		expect(getAllDatasets()[0].rows).toEqual([{ value: 1 }, { value: 2 }]);
		expect(selectDataset).toHaveBeenCalledWith(0);
	});
	it('still adds and selects a successfully ingested sample', async () => {
		await loadPresetDataset(preset, { selectDataset });
		expect(getAllDatasets()).toHaveLength(1);
		expect(getAllDatasets()[0].rows).toEqual([{ value: 1 }]);
		expect(selectDataset).toHaveBeenCalledWith(0);
		expect(document.querySelector('.error-notice')).toBeNull();
		expect(document.querySelector('.toast-progress.success .toast-progress-label')?.textContent).toBe(t('chive-preset-load-success', ['Iris']));
	});
});
