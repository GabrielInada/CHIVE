// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	downloadBytes: vi.fn(),
	exportProject: vi.fn(),
	getPersistenceSnapshot: vi.fn(() => ({ data: { datasets: [], activeIndex: -1 }, panel: null, ui: {} })),
	getProjectImportErrorMessageKey: vi.fn(),
	importProjectBytes: vi.fn(),
	openConfirmDialog: vi.fn(),
	progressHandle: {
		update: vi.fn(),
		succeed: vi.fn(),
		fail: vi.fn(),
		close: vi.fn(),
		onCancel: vi.fn(),
	},
	replaceAllState: vi.fn(),
	showProgress: vi.fn(),
	t: vi.fn(key => `tr:${key}`),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

vi.mock('../../../src/services/downloads/bytes.js', () => ({
	downloadBytes: mocks.downloadBytes,
}));

vi.mock('../../../src/services/persistence.js', () => ({
	PROJECT_FILE_MIME: 'application/vnd.chive.project+sqlite3',
	exportProject: mocks.exportProject,
	importProjectBytes: mocks.importProjectBytes,
	getProjectImportErrorMessageKey: mocks.getProjectImportErrorMessageKey,
}));

vi.mock('../../../src/ui/feedback.js', () => ({
	showProgress: mocks.showProgress,
}));

vi.mock('../../../src/ui/confirmDialog.js', () => ({
	openConfirmDialog: mocks.openConfirmDialog,
}));

vi.mock('../../../src/state/appState.js', () => ({
	getPersistenceSnapshot: mocks.getPersistenceSnapshot,
	replaceAllState: mocks.replaceAllState,
}));

import { setupProjectTransferListeners } from '../../../src/app/bindings/projectTransfer.js';

function setupDom() {
	document.body.innerHTML = `
		<div class="project-menu">
			<button id="btn-project-menu" type="button" aria-expanded="false"></button>
			<div id="project-menu-panel" hidden>
				<button id="btn-project-export" type="button"></button>
				<button id="btn-project-export-work-only" type="button"></button>
				<button id="btn-project-import" type="button"></button>
			</div>
		</div>
		<input id="project-import-input" type="file" />
	`;
}

const flushPromises = async (count = 4) => {
	for (let i = 0; i < count; i += 1) await Promise.resolve();
};

function makeProjectFile(bytes = [9, 8]) {
	const file = new File([new Uint8Array(bytes)], 'project.chive.sqlite3');
	Object.defineProperty(file, 'arrayBuffer', {
		value: vi.fn(async () => new Uint8Array(bytes).buffer),
	});
	return file;
}

function setInputFiles(input, files) {
	Object.defineProperty(input, 'files', {
		value: files,
		configurable: true,
	});
}

describe('eventHandlers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.downloadBytes.mockReturnValue({ ok: true });
		mocks.exportProject.mockResolvedValue({
			ok: true,
			bytes: new Uint8Array([1, 2, 3]),
			fileName: 'project.chive.sqlite3',
		});
		mocks.importProjectBytes.mockResolvedValue({ ok: true });
		mocks.getProjectImportErrorMessageKey.mockReturnValue('chive-project-import-error');
		mocks.showProgress.mockReturnValue(mocks.progressHandle);
		mocks.openConfirmDialog.mockResolvedValue(true);
		setupDom();
	});

	it('handles project export and import controls', async () => {
		setupProjectTransferListeners();

		const menuButton = document.getElementById('btn-project-menu');
		const menuPanel = document.getElementById('project-menu-panel');
		menuButton.click();
		expect(menuPanel.hidden).toBe(false);
		expect(menuButton.getAttribute('aria-expanded')).toBe('true');

		document.getElementById('btn-project-export').click();
		await Promise.resolve();
		await Promise.resolve();

		expect(menuPanel.hidden).toBe(true);
		expect(mocks.exportProject).toHaveBeenCalledWith(mocks.getPersistenceSnapshot(), { workOnly: false });
		expect(mocks.downloadBytes).toHaveBeenCalledWith(
			new Uint8Array([1, 2, 3]),
			'project.chive.sqlite3',
			{ mimeType: 'application/vnd.chive.project+sqlite3' },
		);
		expect(mocks.progressHandle.succeed).toHaveBeenCalledWith('tr:chive-project-export-success');

		menuButton.click();
		document.getElementById('btn-project-export-work-only').click();
		await Promise.resolve();
		await Promise.resolve();
		expect(mocks.exportProject).toHaveBeenLastCalledWith(mocks.getPersistenceSnapshot(), { workOnly: true });

		const importButton = document.getElementById('btn-project-import');
		const importInput = document.getElementById('project-import-input');
		const inputClick = vi.spyOn(importInput, 'click').mockImplementation(() => {});
		importButton.click();
		expect(inputClick).toHaveBeenCalledTimes(1);

		const file = makeProjectFile();
		setInputFiles(importInput, [file]);

		importInput.dispatchEvent(new Event('change', { bubbles: true }));
		await flushPromises();

		expect(mocks.openConfirmDialog).toHaveBeenCalledWith({
			title: 'tr:chive-project-import-confirm-title',
			message: 'tr:chive-project-import-confirm',
			confirmLabel: 'tr:chive-confirm-continue',
			cancelLabel: 'tr:chive-confirm-cancel',
		});
		expect(mocks.importProjectBytes).toHaveBeenCalledWith(
			new Uint8Array([9, 8]),
			expect.objectContaining({ replaceAllState: mocks.replaceAllState }),
		);
		expect(mocks.progressHandle.succeed).toHaveBeenCalledWith('tr:chive-project-import-success');
	});

	it('closes the project menu on outside click and Escape, while ignoring inside clicks', () => {
		setupProjectTransferListeners();

		const menuButton = document.getElementById('btn-project-menu');
		const menuPanel = document.getElementById('project-menu-panel');

		menuButton.click();
		expect(menuPanel.hidden).toBe(false);

		document.querySelector('.project-menu').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(menuPanel.hidden).toBe(false);

		document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(menuPanel.hidden).toBe(true);

		menuButton.click();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(menuPanel.hidden).toBe(true);
	});

	it('tolerates missing project menu/input elements while wiring available controls', async () => {
		setupDom();
		document.getElementById('btn-project-menu').remove();
		document.getElementById('project-menu-panel').remove();
		document.getElementById('project-import-input').remove();
		document.body.insertAdjacentHTML('beforeend', `
			<button id="btn-project-export" type="button"></button>
			<button id="btn-project-import" type="button"></button>
		`);

		setupProjectTransferListeners();

		expect(() => document.getElementById('btn-project-export').click()).not.toThrow();
		await flushPromises();
		expect(mocks.exportProject).toHaveBeenCalled();
		expect(() => document.getElementById('btn-project-import').click()).not.toThrow();
	});

	it('covers project export failure, download failure, thrown export, and busy reentry', async () => {
		setupProjectTransferListeners();
		const exportButton = document.getElementById('btn-project-export');

		mocks.exportProject.mockResolvedValueOnce({ ok: false });
		exportButton.click();
		await flushPromises();
		expect(mocks.progressHandle.fail).toHaveBeenCalledWith('tr:chive-project-export-error');

		mocks.exportProject.mockResolvedValueOnce({
			ok: true,
			bytes: new Uint8Array([1]),
			fileName: 'project.chive.sqlite3',
		});
		mocks.downloadBytes.mockReturnValueOnce({ ok: false });
		exportButton.click();
		await flushPromises();
		expect(mocks.progressHandle.fail).toHaveBeenCalledWith('tr:chive-project-export-error');

		mocks.exportProject.mockRejectedValueOnce(new Error('boom'));
		exportButton.click();
		await flushPromises();
		expect(mocks.progressHandle.fail).toHaveBeenCalledWith('tr:chive-project-export-error');

		let releaseExport;
		mocks.exportProject.mockImplementationOnce(() => new Promise(resolve => {
			releaseExport = () => resolve({
				ok: true,
				bytes: new Uint8Array([2]),
				fileName: 'slow.chive.sqlite3',
			});
		}));
		exportButton.click();
		exportButton.click();
		expect(mocks.showProgress).toHaveBeenCalledWith('tr:chive-project-exporting');
		expect(mocks.exportProject).toHaveBeenCalledTimes(4);
		releaseExport();
		await flushPromises();
	});

	it('covers project import no-file, cancel, failed import, and thrown file reads', async () => {
		setupProjectTransferListeners();
		const importInput = document.getElementById('project-import-input');

		setInputFiles(importInput, []);
		importInput.dispatchEvent(new Event('change', { bubbles: true }));
		await flushPromises();
		expect(mocks.importProjectBytes).not.toHaveBeenCalled();

		mocks.openConfirmDialog.mockResolvedValueOnce(false);
		setInputFiles(importInput, [makeProjectFile([1])]);
		importInput.dispatchEvent(new Event('change', { bubbles: true }));
		await flushPromises();
		expect(mocks.importProjectBytes).not.toHaveBeenCalled();

		mocks.openConfirmDialog.mockResolvedValue(true);
		mocks.importProjectBytes.mockResolvedValueOnce({ ok: false, error: new Error('bad project') });
		setInputFiles(importInput, [makeProjectFile([2])]);
		importInput.dispatchEvent(new Event('change', { bubbles: true }));
		await flushPromises();
		expect(mocks.progressHandle.fail).toHaveBeenCalledWith('tr:chive-project-import-error');

		const badFile = makeProjectFile([3]);
		badFile.arrayBuffer.mockRejectedValueOnce(new Error('read failed'));
		setInputFiles(importInput, [badFile]);
		importInput.dispatchEvent(new Event('change', { bubbles: true }));
		await flushPromises();
		expect(mocks.progressHandle.fail).toHaveBeenCalledWith('tr:chive-project-import-error');
	});
});
