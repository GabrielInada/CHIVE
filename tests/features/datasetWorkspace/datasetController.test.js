// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  t: vi.fn((key, params) => `${key}${params ? `:${params.join('|')}` : ''}`),
  processData: vi.fn(),
  joinDatasets: vi.fn(),
  formatFileSize: vi.fn(size => `${size}B`),
  ingestFile: vi.fn(),
  progressLabelForStage: vi.fn(stage => `label:${stage}`),
  ingestErrorMessage: vi.fn(reason => reason || 'parse-generic'),
  loadPresetSource: vi.fn(),
  addDataset: vi.fn(),
  removeDataset: vi.fn(),
  setActiveDataset: vi.fn(),
  getAllDatasets: vi.fn(),
  showError: vi.fn(),
  showFeedback: vi.fn(),
  clearErrors: vi.fn(),
  showProgress: vi.fn(),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
  t: mocks.t,
}));

vi.mock('../../../src/domain/datasets/processData.js', () => ({
  processData: mocks.processData,
}));

vi.mock('../../../src/domain/datasets/join.js', () => ({
  joinDatasets: mocks.joinDatasets,
}));

// Spread the real module: formatters.js also exports isNullish, which the
// domain/datasets modules import. A bare factory would blank it.
vi.mock('../../../src/utils/formatters.js', async importOriginal => ({
  ...(await importOriginal()),
  formatFileSize: mocks.formatFileSize,
}));

vi.mock('../../../src/services/dataIngestService.js', () => ({
  ingestFile: mocks.ingestFile,
  progressLabelForStage: mocks.progressLabelForStage,
  ingestErrorMessage: mocks.ingestErrorMessage,
}));

vi.mock('../../../src/services/presetService.js', () => ({
  loadPresetSource: mocks.loadPresetSource,
}));

vi.mock('../../../src/state/appState.js', () => ({
  addDataset: mocks.addDataset,
  removeDataset: mocks.removeDataset,
  setActiveDataset: mocks.setActiveDataset,
  getAllDatasets: mocks.getAllDatasets,
}));

vi.mock('../../../src/ui/feedback.js', () => ({
  showError: mocks.showError,
  showFeedback: mocks.showFeedback,
  clearErrors: mocks.clearErrors,
  showProgress: mocks.showProgress,
}));

vi.mock('../../../src/config/limits.js', () => ({
  FILE_SIZE_LIMIT_BYTES: 10,
  ROW_LIMIT: 2,
}));

import {
  getLoadedDatasets,
  handleFileUpload,
  initDatasetController,
  createJoinedDataset,
  handleJoinDatasetRequest,
  handlePresetDatasetRequest,
  removeDatasetByIndex,
  selectDataset,
  setupFileInputListeners,
} from '../../../src/features/datasetWorkspace/datasetController.js';

class FileReaderMock {
  readAsText(file) {
    if (file.__shouldFailRead) {
      this.onerror?.();
      return;
    }

    this.onload?.({ target: { result: file.__content || '' } });
  }
}

function csvFile({
  name = 'ok.csv',
  size = 5,
  content = 'a,b\\n1,2',
  shouldFailRead = false,
} = {}) {
  return {
    name,
    size,
    __content: content,
    __shouldFailRead: shouldFailRead,
  };
}

describe('datasetController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.FileReader = FileReaderMock;
    window.confirm = vi.fn(() => true);
    initDatasetController();

    mocks.loadPresetSource.mockResolvedValue({
      ok: true,
      value: { mode: 'inline', rows: [{ a: 1 }], dropColumns: [] },
    });
    mocks.processData.mockReturnValue({
      rows: [{ a: 1 }],
      columns: [{ name: 'a', type: 'number' }],
    });
    mocks.ingestFile.mockResolvedValue({
      ok: true,
      value: {
        rows: [{ a: 1 }],
        columns: [{ name: 'a', type: 'number' }],
        decimalSeparator: '.',
        statsNumeric: [],
        statsCategorical: [],
        truncatedFrom: null,
      },
    });
    mocks.showProgress.mockImplementation(() => ({
      update: vi.fn(),
      succeed: vi.fn(),
      fail: vi.fn(),
      close: vi.fn(),
      onCancel: vi.fn(),
    }));
    mocks.joinDatasets.mockReturnValue({
      ok: true,
      rows: [{ id: '1' }],
      outputColumns: ['id'],
    });
  });

  it('ignores empty upload and does not clear errors when no files', async () => {
    await handleFileUpload(null);
    await handleFileUpload([]);

    expect(mocks.clearErrors).not.toHaveBeenCalled();
    expect(mocks.addDataset).not.toHaveBeenCalled();
  });

  it('processes valid CSV and adds a normalized dataset', async () => {
    await handleFileUpload([csvFile()]);

    expect(mocks.clearErrors).toHaveBeenCalledTimes(1);
    expect(mocks.ingestFile).toHaveBeenCalledTimes(1);
    const [input] = mocks.ingestFile.mock.calls[0];
    expect(input).toEqual(expect.objectContaining({ kind: 'csv', text: 'a,b\\n1,2' }));
    expect(input.options).toEqual(expect.objectContaining({ rowLimit: 2 }));
    expect(mocks.addDataset).toHaveBeenCalledTimes(1);

    const added = mocks.addDataset.mock.calls[0][0];
    expect(added.name).toBe('ok.csv');
    expect(added.selectedColumns).toEqual(['a']);
    expect(added.chartConfig.bar.enabled).toBe(false);
    expect(added.precomputedStats).toEqual({ numeric: [], categorical: [] });
  });

  it('handles format errors and large-file cancellation', async () => {
    await handleFileUpload([csvFile({ name: 'bad.xyz' })]);
    expect(mocks.showError).toHaveBeenCalledWith(`chive-error-format:bad.xyz`);

    window.confirm = vi.fn(() => false);
    await handleFileUpload([csvFile({ size: 30 })]);
    expect(mocks.showError).toHaveBeenCalledWith('chive-error-cancelled');
  });

  it('surfaces ingest worker errors via the mapped message, not the raw reason', async () => {
    mocks.ingestErrorMessage.mockReturnValueOnce('mapped-detail');
    mocks.ingestFile.mockResolvedValueOnce({ ok: false, reason: 'csv-empty' });
    await handleFileUpload([csvFile()]);

    expect(mocks.ingestErrorMessage).toHaveBeenCalledWith('csv-empty');
    expect(mocks.showError).toHaveBeenCalledWith('chive-error-parse: mapped-detail');
    const progress = mocks.showProgress.mock.results.at(-1).value;
    expect(progress.fail).toHaveBeenCalledWith('chive-progress-failed:mapped-detail');
  });

  it('forwards ROW_LIMIT to the worker; truncation is handled there, not in datasetController', async () => {
    mocks.ingestFile.mockResolvedValueOnce({
      ok: true,
      value: {
        rows: [{ x: 1 }, { x: 2 }],
        columns: [{ name: 'x', type: 'number' }],
        decimalSeparator: '.',
        statsNumeric: [],
        statsCategorical: [],
        truncatedFrom: 3,
      },
    });
    await handleFileUpload([csvFile({ content: 'x\\n1\\n2\\n3' })]);

    expect(mocks.ingestFile).toHaveBeenCalledTimes(1);
    expect(mocks.ingestFile.mock.calls[0][0].options).toEqual(expect.objectContaining({ rowLimit: 2 }));
    expect(mocks.addDataset).toHaveBeenCalledTimes(1);
    expect(mocks.addDataset.mock.calls[0][0].rows).toHaveLength(2);
  });

  it('select/remove/get datasets encaminham para appState com tratamento de erro', () => {
    selectDataset(1);
    removeDatasetByIndex(0);
    expect(mocks.setActiveDataset).toHaveBeenCalledWith(1);
    expect(mocks.removeDataset).toHaveBeenCalledWith(0);

    mocks.setActiveDataset.mockImplementationOnce(() => {
      throw new Error('select boom');
    });
    selectDataset(5);
    expect(mocks.showError).toHaveBeenCalledWith('select boom');

    mocks.removeDataset.mockImplementationOnce(() => {
      throw new Error('remove boom');
    });
    removeDatasetByIndex(5);
    expect(mocks.showError).toHaveBeenCalledWith('remove boom');

    mocks.getAllDatasets.mockReturnValue([{ name: 'X' }]);
    expect(getLoadedDatasets()).toEqual([{ name: 'X' }]);
  });

  it('setupFileInputListeners cobre caminhos missing e interacoes de upload zone', async () => {
    document.body.innerHTML = '';
    setupFileInputListeners();
    expect(mocks.showError).toHaveBeenCalledWith('chive-error-upload-input-missing');
    expect(mocks.showError).toHaveBeenCalledWith('chive-error-upload-zone-missing');

    const input = document.createElement('input');
    input.id = 'file-input';
    const zone = document.createElement('div');
    zone.id = 'upload-zone';
    document.body.innerHTML = '';
    document.body.appendChild(input);
    document.body.appendChild(zone);

    const inputClickSpy = vi.spyOn(input, 'click').mockImplementation(() => {});

    setupFileInputListeners();

    zone.click();
    expect(inputClickSpy).toHaveBeenCalledTimes(1);

    expect(inputClickSpy).toHaveBeenCalledTimes(1);

    const dragOver = new Event('dragover', { bubbles: true, cancelable: true });
    const dragLeave = new Event('dragleave', { bubbles: true });
    zone.dispatchEvent(dragOver);
    expect(zone.classList.contains('hover')).toBe(true);

    zone.dispatchEvent(dragLeave);
    expect(zone.classList.contains('hover')).toBe(false);

    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', {
      value: { files: [csvFile()] },
    });
    zone.dispatchEvent(drop);

    input.dispatchEvent(new Event('change', { bubbles: true }));

    await Promise.resolve();
    expect(mocks.clearErrors).toHaveBeenCalled();
  });

  it('allows re-uploading the same file after delete (regression: clears input value)', async () => {
    const input = document.createElement('input');
    input.id = 'file-input';
    input.type = 'file';

    // Cria um getter/setter para value que funcione
    let inputValue = '';
    Object.defineProperty(input, 'value', {
      get: () => inputValue,
      set: (v) => { inputValue = v; },
      configurable: true,
    });

    document.body.innerHTML = '';
    document.body.appendChild(input);

    // Captura o handler registrado
    let capturedHandler = null;
    const originalAdd = input.addEventListener;
    input.addEventListener = function(event, handler) {
      if (event === 'change') {
        capturedHandler = handler;
      }
      return originalAdd.call(this, event, handler);
    };

    setupFileInputListeners();
    expect(capturedHandler).toBeDefined();

    const testFile = csvFile({ name: 'rows.csv' });

    // Simula change event com target = input
    const mockEvent1 = new Event('change');
    Object.defineProperty(mockEvent1, 'target', {
      value: input,
      configurable: true,
    });

    // Primeiro upload
    input.value = 'C:\\fakepath\\rows.csv';
    Object.defineProperty(input, 'files', {
      value: [testFile],
      configurable: true,
    });

    await capturedHandler(mockEvent1);

    expect(mocks.addDataset).toHaveBeenCalledTimes(1);
    expect(input.value).toBe(''); // Input deve ser limpo

    // Delete dataset
    removeDatasetByIndex(0);
    expect(mocks.removeDataset).toHaveBeenCalledWith(0);
    mocks.addDataset.mockClear();

    // Re-upload do MESMO arquivo
    input.value = 'C:\\fakepath\\rows.csv'; // Mesmo path
    Object.defineProperty(input, 'files', {
      value: [testFile],
      configurable: true,
    });

    const mockEvent2 = new Event('change');
    Object.defineProperty(mockEvent2, 'target', {
      value: input,
      configurable: true,
    });

    await capturedHandler(mockEvent2);

    // addDataset should have been called again (only possible because value was cleared in the handler)
    expect(mocks.addDataset).toHaveBeenCalledTimes(1);
    expect(input.value).toBe('');
  });

  it('creates joined dataset and handles validation errors', () => {
    mocks.getAllDatasets.mockReturnValue([
      {
        name: 'A.csv',
        rows: [{ id: '1', amount: 10 }],
        columns: [{ name: 'id', type: 'text' }, { name: 'amount', type: 'number' }],
      },
      {
        name: 'B.csv',
        rows: [{ id: '1', target: 99 }],
        columns: [{ name: 'id', type: 'text' }, { name: 'target', type: 'number' }],
      },
    ]);

    mocks.processData.mockReturnValue({
      rows: [{ id: '1', target: 99 }],
      columns: [{ name: 'id', type: 'text' }, { name: 'target', type: 'number' }],
    });
    mocks.addDataset.mockReturnValue(2);

    const ok = createJoinedDataset({
      leftIndex: 0,
      rightIndex: 1,
      leftKeys: ['id'],
      rightKeys: ['id'],
      leftColumns: ['id'],
      rightColumns: ['target'],
      joinType: 'inner',
    });

    expect(ok.ok).toBe(true);
    expect(mocks.joinDatasets).toHaveBeenCalled();
    expect(mocks.addDataset).toHaveBeenCalledTimes(1);

    const invalid = createJoinedDataset({
      leftIndex: 0,
      rightIndex: 0,
      leftKeys: ['id'],
      rightKeys: ['id'],
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.message).toBe('chive-join-error-select-different-files');
  });

  it('returns the generic join error when joinDatasets fails, without processing or adding', () => {
    mocks.getAllDatasets.mockReturnValue([
      { name: 'A.csv', rows: [{ id: '1' }], columns: [{ name: 'id', type: 'text' }] },
      { name: 'B.csv', rows: [{ id: '1' }], columns: [{ name: 'id', type: 'text' }] },
    ]);
    mocks.joinDatasets.mockReturnValueOnce({ ok: false, reason: 'join-keys-mismatch' });

    const result = createJoinedDataset({
      leftIndex: 0,
      rightIndex: 1,
      leftKeys: ['id'],
      rightKeys: ['id'],
      leftColumns: ['id'],
      rightColumns: ['id'],
    });

    expect(result.ok).toBe(false);
    expect(result.message).toBe('chive-join-error-generic');
    expect(mocks.processData).not.toHaveBeenCalled();
    expect(mocks.addDataset).not.toHaveBeenCalled();
  });

  it('returns the generic join error when post-join processing throws (safety net)', () => {
    mocks.getAllDatasets.mockReturnValue([
      { name: 'A.csv', rows: [{ id: '1' }], columns: [{ name: 'id', type: 'text' }] },
      { name: 'B.csv', rows: [{ id: '1' }], columns: [{ name: 'id', type: 'text' }] },
    ]);
    mocks.processData.mockImplementationOnce(() => { throw new Error('boom'); });

    const result = createJoinedDataset({
      leftIndex: 0,
      rightIndex: 1,
      leftKeys: ['id'],
      rightKeys: ['id'],
      leftColumns: ['id'],
      rightColumns: ['id'],
    });

    expect(result.ok).toBe(false);
    expect(result.message).toBe('chive-join-error-generic');
    expect(mocks.addDataset).not.toHaveBeenCalled();
  });

  it('uses injected confirmFn instead of window.confirm', async () => {
    const confirmMock = vi.fn(() => false);
    initDatasetController({ confirmCallback: confirmMock });

    await handleFileUpload([csvFile({ size: 30 })]);

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(mocks.showError).toHaveBeenCalledWith('chive-error-cancelled');
  });

  describe('handleJoinDatasetRequest', () => {
    it('activates the joined dataset and shows feedback on success', () => {
      mocks.getAllDatasets.mockReturnValue([
        { name: 'A.csv', rows: [{ id: '1' }], columns: [{ name: 'id', type: 'text' }] },
        { name: 'B.csv', rows: [{ id: '1' }], columns: [{ name: 'id', type: 'text' }] },
      ]);
      mocks.processData.mockReturnValue({ rows: [{ id: '1' }], columns: [{ name: 'id', type: 'text' }] });
      mocks.addDataset.mockReturnValue(2);

      handleJoinDatasetRequest({
        leftIndex: 0,
        rightIndex: 1,
        leftKeys: ['id'],
        rightKeys: ['id'],
        leftColumns: ['id'],
        rightColumns: ['id'],
        joinType: 'inner',
      });

      expect(mocks.addDataset).toHaveBeenCalledTimes(1);
      expect(mocks.setActiveDataset).toHaveBeenCalledWith(2);
      expect(mocks.showFeedback).toHaveBeenCalled();
    });

    it('surfaces the error and does not activate when the join is invalid', () => {
      mocks.getAllDatasets.mockReturnValue([{ name: 'only-one.csv' }]);

      handleJoinDatasetRequest({ leftIndex: 0, rightIndex: 1, leftKeys: ['id'], rightKeys: ['id'] });

      expect(mocks.showError).toHaveBeenCalledWith('chive-join-error-min-files');
      expect(mocks.setActiveDataset).not.toHaveBeenCalled();
      expect(mocks.showFeedback).not.toHaveBeenCalled();
    });
  });

  describe('handlePresetDatasetRequest', () => {
    it('adds and activates an inline preset', async () => {
      mocks.addDataset.mockReturnValueOnce(3);

      await handlePresetDatasetRequest({ nameKey: 'preset-name', rows: 1 });

      expect(mocks.loadPresetSource).toHaveBeenCalledWith(
        { nameKey: 'preset-name', rows: 1 },
        { signal: expect.any(AbortSignal) },
      );
      expect(mocks.processData).toHaveBeenCalledWith([{ a: 1 }]);
      expect(mocks.addDataset).toHaveBeenCalledTimes(1);
      const added = mocks.addDataset.mock.calls[0][0];
      expect(added.name).toBe('preset-name');
      expect(added.selectedColumns).toEqual(['a']);
      expect(added.precomputedStats).toEqual({ numeric: [], categorical: [] });
      expect(mocks.setActiveDataset).toHaveBeenCalledWith(3);
      const progress = mocks.showProgress.mock.results.at(-1).value;
      expect(progress.succeed).toHaveBeenCalledWith('chive-preset-load-success:preset-name');
    });

    it('reports a null preset as a generic error', async () => {
      await handlePresetDatasetRequest(null);

      expect(mocks.showError).toHaveBeenCalledWith('chive-join-error-generic');
      expect(mocks.addDataset).not.toHaveBeenCalled();
    });

    it('maps a fetched-ingest failure and adds nothing', async () => {
      mocks.loadPresetSource.mockResolvedValueOnce({
        ok: true,
        value: { mode: 'fetched', kind: 'csv', text: 'a,b', dropColumns: ['drop'] },
      });
      mocks.ingestFile.mockResolvedValueOnce({ ok: false, reason: 'csv-empty' });
      mocks.ingestErrorMessage.mockReturnValueOnce('mapped-detail');

      await handlePresetDatasetRequest({ nameKey: 'preset-name', rows: 1 });

      expect(mocks.ingestFile).toHaveBeenCalledWith(
        expect.objectContaining({ options: expect.objectContaining({ dropColumns: ['drop'] }) }),
        expect.anything(),
      );
      expect(mocks.ingestErrorMessage).toHaveBeenCalledWith('csv-empty');
      const progress = mocks.showProgress.mock.results.at(-1).value;
      expect(progress.fail).toHaveBeenCalledWith('chive-progress-failed:mapped-detail');
      expect(mocks.addDataset).not.toHaveBeenCalled();
      expect(mocks.setActiveDataset).not.toHaveBeenCalled();
    });

    it('closes the toast on cancellation without error or dataset work', async () => {
      mocks.loadPresetSource.mockResolvedValueOnce({ ok: false, reason: 'cancelled' });

      await handlePresetDatasetRequest({ nameKey: 'preset-name', rows: 1 });

      const progress = mocks.showProgress.mock.results.at(-1).value;
      expect(progress.close).toHaveBeenCalled();
      expect(mocks.showError).not.toHaveBeenCalled();
      expect(mocks.addDataset).not.toHaveBeenCalled();
    });

    it('shows the timeout message and generic error on a fetch timeout', async () => {
      mocks.loadPresetSource.mockResolvedValueOnce({ ok: false, reason: 'preset-fetch-timeout' });

      await handlePresetDatasetRequest({ nameKey: 'preset-name', rows: 1 });

      const progress = mocks.showProgress.mock.results.at(-1).value;
      expect(progress.fail).toHaveBeenCalledWith('chive-preset-fetch-timeout:preset-name');
      expect(mocks.showError).toHaveBeenCalledWith('chive-join-error-generic');
      expect(mocks.addDataset).not.toHaveBeenCalled();
    });

    it('shows the generic failure on a network error', async () => {
      mocks.loadPresetSource.mockResolvedValueOnce({ ok: false, reason: 'preset-fetch-network' });

      await handlePresetDatasetRequest({ nameKey: 'preset-name', rows: 1 });

      const progress = mocks.showProgress.mock.results.at(-1).value;
      expect(progress.fail).toHaveBeenCalledWith('chive-progress-failed:preset-fetch-network');
      expect(mocks.showError).toHaveBeenCalledWith('chive-join-error-generic');
      expect(mocks.addDataset).not.toHaveBeenCalled();
    });
  });
});
