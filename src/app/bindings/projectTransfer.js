/**
 * CHIVE project transfer workflow.
 *
 * Wires the project menu (open/close) and its export / export-work-only / import
 * actions. Import replaces all state; a module-level busy flag blocks overlapping
 * export/import runs.
 */

import { t } from '../../services/i18nService.js';
import {
	PROJECT_FILE_MIME,
	exportProject,
	getProjectImportErrorMessageKey,
	importProjectBytes,
} from '../../services/persistence.js';
import { downloadBytes } from '../../utils/downloadBytes.js';
import { rehydratePanelChartSpecs } from '../../utils/panelHydration.js';
import { getPersistenceSnapshot, replaceAllState } from '../../state/appState.js';
import { showProgress } from '../feedbackUI.js';
import { FILE_IDS } from '../../config/elementIds.js';

let projectTransferBusy = false;
let menuDismissListenersReady = false;

/**
 * Internal workflow setup, called by `app/domBindings.js`.
 * Wires the project menu toggle and the export/import buttons. Global menu-dismiss
 * listeners are registered once; element-scoped controls are wired for the current
 * DOM on every call.
 */
export function setupProjectTransferListeners() {
	const menuButton = document.getElementById(FILE_IDS.projectMenuButton);
	const menuPanel = document.getElementById(FILE_IDS.projectMenuPanel);

	if (menuButton && menuPanel) {
		menuButton.addEventListener('click', event => {
			event.stopPropagation();
			setProjectMenuOpen(menuPanel.hidden);
		});
	}

	ensureMenuDismissListeners();

	document.getElementById(FILE_IDS.projectExportButton)
		?.addEventListener('click', () => {
			setProjectMenuOpen(false);
			void handleProjectExport({ workOnly: false });
		});
	document.getElementById(FILE_IDS.projectExportWorkOnlyButton)
		?.addEventListener('click', () => {
			setProjectMenuOpen(false);
			void handleProjectExport({ workOnly: true });
		});
	document.getElementById(FILE_IDS.projectImportButton)
		?.addEventListener('click', () => {
			setProjectMenuOpen(false);
			document.getElementById(FILE_IDS.projectImportInput)?.click();
		});

	const importInput = document.getElementById(FILE_IDS.projectImportInput);
	if (importInput) {
		importInput.addEventListener('change', event => {
			const file = event.target?.files?.[0] || null;
			void handleProjectImport(file, importInput);
		});
	}
}

/**
 * Register the global menu-dismiss listeners once. Kept outside the
 * `menuButton && menuPanel` check on purpose: both handlers look the panel up
 * fresh and bail when it is absent, so registering unconditionally lets the menu
 * still dismiss if it is inserted or rebuilt after setup.
 *
 * @private
 */
function ensureMenuDismissListeners() {
	if (menuDismissListenersReady) return;
	document.addEventListener('click', onDocumentClickCloseMenu);
	document.addEventListener('keydown', onDocumentKeydownCloseMenu);
	menuDismissListenersReady = true;
}

/** @private */
function onDocumentClickCloseMenu(event) {
	const menuPanel = document.getElementById(FILE_IDS.projectMenuPanel);
	if (!menuPanel || menuPanel.hidden) return;
	if (typeof event.target?.closest === 'function' && event.target.closest('.project-menu')) return;
	setProjectMenuOpen(false);
}

/** @private */
function onDocumentKeydownCloseMenu(event) {
	if (event.key === 'Escape') setProjectMenuOpen(false);
}

/**
 * @private
 */
function setProjectMenuOpen(open) {
	const menuButton = document.getElementById(FILE_IDS.projectMenuButton);
	const menuPanel = document.getElementById(FILE_IDS.projectMenuPanel);
	if (!menuButton || !menuPanel) return;
	menuPanel.hidden = !open;
	menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
}

/**
 * @private
 */
async function handleProjectExport({ workOnly = false } = {}) {
	if (projectTransferBusy) return;
	projectTransferBusy = true;
	const progress = showProgress(t('chive-project-exporting'));
	try {
		progress.update(20);
		const result = await exportProject(getPersistenceSnapshot(), { workOnly });
		if (!result.ok) {
			progress.fail(t('chive-project-export-error'));
			return;
		}

		progress.update(85);
		const downloadResult = downloadBytes(result.bytes, result.fileName, { mimeType: PROJECT_FILE_MIME });
		if (!downloadResult.ok) {
			progress.fail(t('chive-project-export-error'));
			return;
		}
		progress.succeed(t('chive-project-export-success'));
	} catch {
		progress.fail(t('chive-project-export-error'));
	} finally {
		projectTransferBusy = false;
	}
}

/**
 * @private
 */
async function handleProjectImport(file, input) {
	if (!file || projectTransferBusy) {
		if (input) input.value = '';
		return;
	}

	const confirmed = window.confirm(t('chive-project-import-confirm'));
	if (!confirmed) {
		input.value = '';
		return;
	}

	projectTransferBusy = true;
	const progress = showProgress(t('chive-project-importing'));
	try {
		progress.update(20);
		const bytes = new Uint8Array(await file.arrayBuffer());
		progress.update(55);
		const result = await importProjectBytes(bytes, {
			replaceAllState,
			transformPanel: rehydratePanelChartSpecs,
		});
		if (!result.ok) {
			progress.fail(t(getProjectImportErrorMessageKey(result.error)));
			return;
		}
		progress.succeed(t('chive-project-import-success'));
	} catch (err) {
		progress.fail(t(getProjectImportErrorMessageKey(err)));
	} finally {
		input.value = '';
		projectTransferBusy = false;
	}
}
