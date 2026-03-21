/**
 * CHIVE Event Handlers
 * 
 * Coordinates all application event listeners:
 * - Kebab menu (chart actions: download, add-to-panel)
 * - Language selector
 * - Sidebar toggle
 * - Global keyboard shortcuts
 */

import { t, definirLocale, obterLocale } from '../services/i18nService.js';
import { downloadSvgFromContainer } from '../utils/svgExport.js';
import { addChartToPanel, setupPanelEventListeners } from './panelManager.js';
import { showError, showFeedback } from './feedbackUI.js';
import { setupFileInputListeners, selectDataset, removeDatasetByIndex } from './fileManager.js';
import { setupTabListeners, setupSidebarToggleListener, switchTab } from './uiManager.js';
import { getActiveDataset, updateActiveDatasetConfig } from './appState.js';

/**
 * Initialize all event handlers
 * Called once during app startup
 */
export function initializeAllEventHandlers() {
	setupFileInputListeners();
	setupTabListeners();
	setupSidebarToggleListener();
	setupSidebarNavigationButtons();
	setupPanelEventListeners();
	setupChartKebabMenuListeners();
	setupLanguageSelectorListeners();
	setupGlobalKeyboardListeners();
	setupDatasetListeners();
}

/**
 * Setup sidebar navigation buttons
 * @private
 */
function setupSidebarNavigationButtons() {
	const btnAvancar = document.getElementById('btn-avancar');
	const btnEditarColunas = document.getElementById('btn-editar-colunas');
	const btnIrPainel = document.getElementById('btn-ir-painel');
	const btnVoltarViz = document.getElementById('btn-voltar-viz');

	if (btnAvancar) {
		btnAvancar.addEventListener('click', () => {
			navigateToTab('charts');
		});
	}

	if (btnEditarColunas) {
		btnEditarColunas.addEventListener('click', () => {
			navigateToTab('preview');
		});
	}

	if (btnIrPainel) {
		btnIrPainel.addEventListener('click', () => {
			navigateToTab('panel');
		});
	}

	if (btnVoltarViz) {
		btnVoltarViz.addEventListener('click', () => {
			navigateToTab('charts');
		});
	}
}

/**
 * Navigate UI and active dataset config to a specific tab
 * @private
 */
function navigateToTab(tabName) {
	const dataset = getActiveDataset();
	if (dataset?.configGraficos) {
		updateActiveDatasetConfig({
			...dataset.configGraficos,
			aba: tabName,
		});
	}
	switchTab(tabName);
}

/**
 * Setup kebab menu (three dots) chart actions
 * Handles: Download SVG, Add to Panel
 * @private
 */
function setupChartKebabMenuListeners() {
	document.addEventListener('click', event => {
		// Kebab menu button click
		const menuBtn = event.target.closest('[data-chart-menu-btn]');
		if (menuBtn) {
			event.stopPropagation();
			toggleChartMenu(menuBtn.dataset.chartMenuBtn);
			return;
		}

		// Menu item click (action)
		const menuItem = event.target.closest('[data-chart-action]');
		if (menuItem) {
			event.stopPropagation();
			handleChartAction(menuItem);
			closeAllChartMenus();
			return;
		}

		// Close menu if clicking outside
		if (!event.target.closest('[data-chart-actions]')) {
			closeAllChartMenus();
		}
	});

	// Close menu on Escape
	document.addEventListener('keydown', event => {
		if (event.key === 'Escape') {
			closeAllChartMenus();
		}
	});
}

/**
 * Toggle kebab menu visibility
 * @private
 */
function toggleChartMenu(menuId) {
	const menu = document.querySelector(`[data-chart-menu="${menuId}"]`);
	const button = document.querySelector(`[data-chart-menu-btn="${menuId}"]`);
	if (!menu) return;

	const isHidden = menu.hidden === true;
	closeAllChartMenus();

	if (isHidden) {
		menu.hidden = false;
		if (button) {
			button.setAttribute('aria-expanded', 'true');
		}
	}
}

/**
 * Close all open kebab menus
 * @private
 */
function closeAllChartMenus() {
	document.querySelectorAll('[data-chart-menu]').forEach(menu => {
		menu.hidden = true;
	});
	document.querySelectorAll('[data-chart-menu-btn]').forEach(button => {
		button.setAttribute('aria-expanded', 'false');
	});
}

/**
 * Handle chart action (download-svg or add-panel)
 * @private
 */
function handleChartAction(menuItem) {
	const action = menuItem.dataset.chartAction;
	const containerId = menuItem.dataset.chartContainer;

	if (action === 'download-svg') {
		const filename = menuItem.dataset.chartFilename || 'chart';
		const result = downloadSvgFromContainer(containerId, filename);
		if (!result.ok) {
			showError(t('chive-chart-download-error'));
		}
	} else if (action === 'add-panel') {
		// Get chart name from DOM
		const chartBlock = menuItem.closest('.chart-bloco');
		const titulo = chartBlock?.querySelector('.chart-titulo')?.textContent?.trim()
			|| t('chive-card-charts');

		const result = addChartToPanel(containerId, titulo);
		if (!result.ok) {
			showError(t('chive-panel-add-error'));
		} else {
			showFeedback(t('chive-panel-add-success'));
		}
	}
}

/**
 * Setup language selector
 * @private
 */
function setupLanguageSelectorListeners() {
	const selectLang = document.getElementById('select-lang');
	const langDisplay = document.getElementById('lang-display');
	if (!selectLang) return;

	// Map locale codes to display text
	const localeLabels = {
		'pt-BR': 'Português',
		'en': 'English'
	};

	// Update display button text
	const updateDisplay = (locale) => {
		if (langDisplay) {
			langDisplay.textContent = localeLabels[locale] || locale;
		}
	};

	selectLang.addEventListener('change', event => {
		const locale = event.target.value;
		updateDisplay(locale);
		definirLocale(locale);
	});

	// Update selector on locale change
	window.addEventListener('chive-locale-changed', () => {
		const currentLocale = obterLocale();
		selectLang.value = currentLocale;
		updateDisplay(currentLocale);
	});

	// Initialize display with current locale
	const currentLocale = obterLocale();
	updateDisplay(currentLocale);
}

/**
 * Setup global keyboard shortcuts
 * @private
 */
function setupGlobalKeyboardListeners() {
	document.addEventListener('keydown', event => {
		// Escape: close menus
		if (event.key === 'Escape') {
			closeAllChartMenus();
		}

		// Ctrl+O or Cmd+O: open file picker
		if ((event.ctrlKey || event.metaKey) && event.key === 'o') {
			event.preventDefault();
			document.getElementById('input-arquivo')?.click();
		}
	});
}

/**
 * Setup dataset list interactions
 * @private
 */
function setupDatasetListeners() {
	// Delegated listeners for dataset buttons (rendered in resultsView)
	document.addEventListener('click', event => {
		// Select dataset
		const selectBtn = event.target.closest('[data-dataset-select]');
		if (selectBtn) {
			event.preventDefault();
			const index = parseInt(selectBtn.dataset.datasetSelect, 10);
			selectDataset(index);
			return;
		}

		// Remove dataset
		const removeBtn = event.target.closest('[data-dataset-remove]');
		if (removeBtn) {
			event.preventDefault();
			const index = parseInt(removeBtn.dataset.datasetRemove, 10);
			removeDatasetByIndex(index);
			return;
		}
	});
}

/**
 * Setup result preview table interactions
 * @private
 */
export function setupResultsViewListeners() {
	// Column selection
	const listaColunas = document.getElementById('lista-colunas-conteudo');
	if (listaColunas) {
		listaColunas.addEventListener('change', event => {
			if (event.target.type === 'checkbox' && !event.target.disabled) {
				// Callback will be in resultsView.js setup
			}
		});
	}

	// Column action buttons
	document.addEventListener('click', event => {
		const acoesBtn = event.target.closest('[data-acao-coluna]');
		if (acoesBtn) {
			const acao = acoesBtn.dataset.acaoColuna;
			// Callback will be in resultsView.js setup
		}
	});
}
