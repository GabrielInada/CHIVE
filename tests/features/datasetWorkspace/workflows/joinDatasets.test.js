// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createJoinedDataset } from '../../../../src/features/datasetWorkspace/workflows/joinDatasets.js';
import { uploadDatasetFiles } from '../../../../src/features/datasetWorkspace/workflows/uploadDataset.js';
import { __setIngestWorkerFactoryForTesting } from '../../../../src/services/dataIngestService.js';
import { setLocale, t } from '../../../../src/services/i18nService.js';
import { addDataset, getAllDatasets, replaceAllState } from '../../../../src/state/appState.js';
import { clearAllFeedback } from '../../../../src/ui/feedback.js';
import { restoreIngestWorker, useInProcessIngestWorker, useSilentIngestWorker } from '../../../helpers/ingestWorker.js';

// jsdom's FileReader finishes on setImmediate, so that timer stays real.
const TIMERS_TO_FAKE = ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'];

vi.mock('../../../../src/config/limits.js', async importOriginal => ({
	...(await importOriginal()),
	LARGE_DATASET_WARNING_ROWS: 2,
}));

const spec = {
	leftIndex: 0,
	rightIndex: 1,
	leftKeys: ['id'],
	rightKeys: ['id'],
	leftColumns: ['id', 'amount'],
	rightColumns: ['target'],
	joinType: 'inner',
};

function addSources(leftIds = ['a', 'b']) {
	addDataset({
		name: 'A.csv',
		rows: leftIds.map((id, index) => ({ id, amount: index + 1 })),
		columns: [{ name: 'id', type: 'text' }, { name: 'amount', type: 'number' }],
	});
	addDataset({
		name: 'B.csv',
		rows: [{ id: 'a', target: 10 }, { id: 'b', target: 20 }, { id: 'c', target: 30 }],
		columns: [{ name: 'id', type: 'text' }, { name: 'target', type: 'number' }],
	});
}

// Spelled out so a parameter in the wrong slot fails the test.
const messages = {
	en: {
		largeJoin: (rows, limit) => `This join would create ${rows} rows, above the recommended limit (${limit}). Keep the complete result?`,
		failed: (left, right) => `Could not join "${left}" and "${right}". Please try again.`,
	},
	'pt-BR': {
		largeJoin: (rows, limit) => `Esta junção criaria ${rows} linhas, acima do limite recomendado (${limit}). Deseja manter o resultado completo?`,
		failed: (left, right) => `Não foi possível unir "${left}" e "${right}". Tente novamente.`,
	},
};

const notices = () => [...document.querySelectorAll('.error-notice > div')].map(node => node.textContent);

describe.each(['en', 'pt-BR'])('dataset join in %s', language => {
	let workerRequests;
	let confirm;
	let selectDataset;
	const format = value => value.toLocaleString(language);
	const text = messages[language];

	beforeEach(async () => {
		vi.useFakeTimers({ toFake: TIMERS_TO_FAKE });
		document.body.replaceChildren();
		replaceAllState({ data: { datasets: [], activeIndex: -1 } });
		await setLocale(language);
		workerRequests = useInProcessIngestWorker();
		confirm = vi.fn(() => true);
		selectDataset = vi.fn();
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
		expect(getAllDatasets()).toHaveLength(2);
		expect(selectDataset).not.toHaveBeenCalled();
	}

	it('adds the join as a new dataset, selects it and says so in the progress toast', async () => {
		addSources();
		const result = await createJoinedDataset(spec, { confirm, selectDataset });
		const joined = getAllDatasets()[2];

		expect(result).toEqual({ ok: true, index: 2 });
		expect(joined.name).toMatch(new RegExp(`^${t('chive-join-name-prefix')} A \\+ B \\(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\)$`));
		expect(joined.sizeLabel).toBe(t('chive-join-generated-size', [2]));
		expect(joined.rows).toEqual([{ id: 'a', amount: 1, target: 10 }, { id: 'b', amount: 2, target: 20 }]);
		expect(joined.selectedColumns).toEqual(['id', 'amount', 'target']);
		expect(selectDataset).toHaveBeenCalledExactlyOnceWith(2);
		expect(document.querySelector('.toast-progress.success .toast-progress-label')?.textContent)
			.toBe(t('chive-join-success', [joined.name]));
		expect(document.querySelector('.toast-feedback')).toBeNull();
		expect(confirm).not.toHaveBeenCalled();
	});

	it('reports an invalid join with a notice and no progress toast', async () => {
		addSources();
		const result = await createJoinedDataset({ ...spec, rightIndex: 0 }, { confirm, selectDataset });

		expect(result).toEqual({ ok: false, reason: 'same-file' });
		expect(notices()).toEqual([t('chive-join-error-select-different-files')]);
		expect(document.querySelector('#toast-progress')).toBeNull();
		expect(workerRequests).toEqual([]);
		expect(getAllDatasets()).toHaveLength(2);
	});

	it('asks before keeping a join above the row limit and runs it only once', async () => {
		addSources(['a', 'b', 'c']);
		await createJoinedDataset(spec, { confirm, selectDataset });

		expect(confirm).toHaveBeenCalledExactlyOnceWith(text.largeJoin(format(3), format(2)));
		expect(workerRequests).toHaveLength(1);
		expect(workerRequests[0].options).not.toHaveProperty('rowLimit');
		expect(getAllDatasets()[2].rows).toHaveLength(3);
		expect(selectDataset).toHaveBeenCalledExactlyOnceWith(2);
	});

	it('closes quietly when the join warning is declined', async () => {
		addSources(['a', 'b', 'c']);
		confirm.mockReturnValue(false);
		await expectQuietCancel(createJoinedDataset(spec, { confirm, selectDataset }));
	});

	it('declines the join warning itself when nothing can confirm it', async () => {
		addSources(['a', 'b', 'c']);
		await expectQuietCancel(createJoinedDataset(spec, { selectDataset }));
	});

	it('closes quietly when cancelled mid-join', async () => {
		addSources();
		const reached = useSilentIngestWorker();
		const run = createJoinedDataset(spec, { confirm, selectDataset });
		await reached;
		document.querySelector('.toast-progress-cancel').click();
		await expectQuietCancel(run);
	});

	it('names both datasets when the join fails, without its reason code', async () => {
		addSources();
		__setIngestWorkerFactoryForTesting(() => ({
			postMessage({ id }) {
				queueMicrotask(() => this.onmessage({ data: { id, type: 'error', reason: 'worker-error-private-detail' } }));
			},
			terminate() {},
		}));
		const result = await createJoinedDataset(spec, { confirm, selectDataset });
		const message = text.failed('A.csv', 'B.csv');

		expect(result).toEqual({ ok: false, reason: 'worker-error-private-detail' });
		expect(notices()).toEqual([message]);
		expect(document.querySelector('.toast-progress.failure .toast-progress-label')?.textContent).toBe(message);
		expect(document.body.textContent).not.toContain('private-detail');
		expect(getAllDatasets()).toHaveLength(2);
	});

	it.each([
		{ separator: ',', expected: 1000 },
		{ separator: '.', expected: 1 },
	])('keeps the $separator upload format when a join makes a mixed text column numeric', async ({ separator, expected }) => {
		const upload = new File(['id,population\na,1.000\nb,unknown\n'], 'numbers.csv');
		await uploadDatasetFiles([upload], { confirm }, { decimalSeparator: separator });
		expect(getAllDatasets()[0].columns).toContainEqual(expect.objectContaining({ name: 'population', type: 'text' }));
		expect(getAllDatasets()[0].rows[0].population).toBe('1.000');
		addDataset({ name: 'selected.csv', rows: [{ id: 'a' }], columns: [{ name: 'id', type: 'text' }] });

		const result = await createJoinedDataset(
			{ ...spec, leftColumns: ['population'], rightColumns: [] },
			{ confirm, selectDataset },
		);

		expect(result.ok).toBe(true);
		expect(getAllDatasets()[2].rows).toEqual([{ population: expected }]);
	});

	it('keeps opposite formats through renamed columns and repeated joins', async () => {
		for (const separator of [',', '.']) {
			const upload = new File(['id,population\na,1.000\nb,unknown\n'], 'numbers.csv');
			await uploadDatasetFiles([upload], { confirm }, { decimalSeparator: separator });
		}
		const first = await createJoinedDataset(
			{ ...spec, leftColumns: ['id', 'population'], rightColumns: ['population'] },
			{ confirm, selectDataset },
		);
		expect(first.ok).toBe(true);
		expect(getAllDatasets()[2].columns).toEqual([
			{ name: 'id', type: 'text', decimalSeparator: ',' },
			{ name: 'numbers.population', type: 'text', decimalSeparator: ',' },
			{ name: 'numbers.population_2', type: 'text', decimalSeparator: '.' },
		]);
		addDataset({ name: 'selected.csv', rows: [{ id: 'a' }], columns: [{ name: 'id', type: 'text' }] });

		const second = await createJoinedDataset({
			...spec,
			leftIndex: 2,
			rightIndex: 3,
			leftColumns: ['numbers.population_2', 'numbers.population'],
			rightColumns: [],
		}, { confirm, selectDataset });

		expect(second.ok).toBe(true);
		expect(getAllDatasets()[4].rows).toEqual([{ 'numbers.population_2': 1, 'numbers.population': 1000 }]);
		expect(getAllDatasets()[0].rows[0].population).toBe('1.000');
		expect(getAllDatasets()[1].rows[0].population).toBe('1.000');
	});
});
