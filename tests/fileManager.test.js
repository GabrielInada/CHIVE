// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  t: vi.fn((key, params) => `${key}${params ? `:${params.join('|')}` : ''}`),
  parseCsv: vi.fn(),
  parseJson: vi.fn(),
  processData: vi.fn(),
  formatFileSize: vi.fn(size => `${size}B`),
  addDataset: vi.fn(),
  removeDataset: vi.fn(),
  setActiveDataset: vi.fn(),
  getAllDatasets: vi.fn(),
  showError: vi.fn(),
  clearErrors: vi.fn(),
}));

vi.mock('../src/services/i18nService.js', () => ({
  t: mocks.t,
}));

vi.mock('../src/services/dataService.js', () => ({
  parseCsv: mocks.parseCsv,
  parseJson: mocks.parseJson,
  processData: mocks.processData,
  formatFileSize: mocks.formatFileSize,
}));

vi.mock('../src/modules/appState.js', () => ({
  addDataset: mocks.addDataset,
  removeDataset: mocks.removeDataset,
  setActiveDataset: mocks.setActiveDataset,
  getAllDatasets: mocks.getAllDatasets,
}));

vi.mock('../src/modules/feedbackUI.js', () => ({
  showError: mocks.showError,
  clearErrors: mocks.clearErrors,
}));

vi.mock('../src/config/limits.js', () => ({
  FILE_SIZE_LIMIT_BYTES: 10,
  ROW_LIMIT: 2,
}));

import {
  getLoadedDatasets,
  handleFileUpload,
  initFileManager,
  removeDatasetByIndex,
  selectDataset,
  setupFileInputListeners,
} from '../src/modules/fileManager.js';

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

describe('fileManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.FileReader = FileReaderMock;
    window.confirm = vi.fn(() => true);

    mocks.processData.mockReturnValue({
      dados: [{ a: 1 }],
      colunas: [{ nome: 'a', tipo: 'numero' }],
    });
    mocks.parseCsv.mockReturnValue([{ a: '1' }]);
    mocks.parseJson.mockReturnValue([{ a: 1 }]);
  });

  it('ignora upload vazio e nao limpa erros quando sem arquivos', async () => {
    await handleFileUpload(null);
    await handleFileUpload([]);

    expect(mocks.clearErrors).not.toHaveBeenCalled();
    expect(mocks.addDataset).not.toHaveBeenCalled();
  });

  it('processa CSV valido e adiciona dataset normalizado', async () => {
    const onChange = vi.fn();
    initFileManager(onChange);

    await handleFileUpload([csvFile()]);

    expect(mocks.clearErrors).toHaveBeenCalledTimes(1);
    expect(mocks.parseCsv).toHaveBeenCalledWith('a,b\\n1,2');
    expect(mocks.addDataset).toHaveBeenCalledTimes(1);

    const added = mocks.addDataset.mock.calls[0][0];
    expect(added.nome).toBe('ok.csv');
    expect(added.colunasSelecionadas).toEqual(['a']);
    expect(added.configGraficos.bar.enabled).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('trata erros de formato e cancelamento de arquivo grande', async () => {
    await handleFileUpload([csvFile({ name: 'bad.txt' })]);
    expect(mocks.showError).toHaveBeenCalledWith('chive-error-format');

    window.confirm = vi.fn(() => false);
    await handleFileUpload([csvFile({ size: 30 })]);
    expect(mocks.showError).toHaveBeenCalledWith('chive-error-cancelled');
  });

  it('trata erro de parse e limita linhas quando ultrapassa ROW_LIMIT', async () => {
    mocks.parseCsv.mockImplementationOnce(() => {
      throw new Error('parse fail');
    });
    await handleFileUpload([csvFile()]);
    expect(mocks.showError).toHaveBeenCalledWith('chive-error-parse: parse fail');

    mocks.parseCsv.mockReturnValueOnce([{ x: 1 }, { x: 2 }, { x: 3 }]);
    await handleFileUpload([csvFile({ content: 'x\\n1\\n2\\n3' })]);

    expect(window.confirm).toHaveBeenCalled();
    expect(mocks.processData).toHaveBeenCalledWith([{ x: 1 }, { x: 2 }], 'ok.csv');
  });

  it('select/remove/get datasets encaminham para appState com tratamento de erro', () => {
    const onChange = vi.fn();
    initFileManager(onChange);

    selectDataset(1);
    removeDatasetByIndex(0);
    expect(mocks.setActiveDataset).toHaveBeenCalledWith(1);
    expect(mocks.removeDataset).toHaveBeenCalledWith(0);
    expect(onChange).toHaveBeenCalledTimes(2);

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

    mocks.getAllDatasets.mockReturnValue([{ nome: 'X' }]);
    expect(getLoadedDatasets()).toEqual([{ nome: 'X' }]);
  });

  it('setupFileInputListeners cobre caminhos missing e interacoes de upload zone', async () => {
    document.body.innerHTML = '';
    setupFileInputListeners();
    expect(mocks.showError).toHaveBeenCalledWith('chive-error-upload-input-missing');
    expect(mocks.showError).toHaveBeenCalledWith('chive-error-upload-zone-missing');

    const input = document.createElement('input');
    input.id = 'input-arquivo';
    const zone = document.createElement('div');
    zone.id = 'zona-upload';
    document.body.innerHTML = '';
    document.body.appendChild(input);
    document.body.appendChild(zone);

    const inputClickSpy = vi.spyOn(input, 'click').mockImplementation(() => {});

    setupFileInputListeners();

    zone.click();
    expect(inputClickSpy).toHaveBeenCalledTimes(1);

    zone.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    zone.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(inputClickSpy).toHaveBeenCalledTimes(3);

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

  it('permite fazer re-upload do mesmo arquivo apos delete (regression: limpa input value)', async () => {
    const onChange = vi.fn();
    initFileManager(onChange);

    const input = document.createElement('input');
    input.id = 'input-arquivo';
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

    const testFile = csvFile({ name: 'dados.csv' });

    // Simula change event com target = input
    const mockEvent1 = new Event('change');
    Object.defineProperty(mockEvent1, 'target', {
      value: input,
      configurable: true,
    });

    // Primeiro upload
    input.value = 'C:\\fakepath\\dados.csv';
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
    input.value = 'C:\\fakepath\\dados.csv'; // Mesmo path
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

    // Deve ter chamado addDataset novamente (só é possível porque value foi limpo no handler)
    expect(mocks.addDataset).toHaveBeenCalledTimes(1);
    expect(input.value).toBe('');
  });
});
