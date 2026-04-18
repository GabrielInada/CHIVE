/**
 * CHIVE Event Handlers
 * 
 * Coordinates all application event listeners:
 * - Kebab menu (chart actions: download, add-to-panel)
 * - Language selector
 * - Sidebar toggle
 * - Global keyboard shortcuts
 */

import { t, setLocale, getLocale } from '../services/i18nService.js';
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
		const fallbackTitle = chartBlock?.querySelector('.chart-titulo')?.textContent?.trim()
			|| t('chive-card-charts');
		const titulo = getChartSnapshotTitle(containerId, fallbackTitle);
		const metadata = buildChartSnapshotMetadata(containerId);

		const result = addChartToPanel(containerId, titulo, metadata);
		if (!result.ok) {
			showError(t('chive-panel-add-error'));
		} else {
			showFeedback(t('chive-panel-add-success'));
		}
	}
}

function getChartSnapshotTitle(containerId, fallbackTitle) {
	const dataset = getActiveDataset();
	const config = dataset?.configGraficos || {};

	if (containerId === 'chart-bar-container') {
		return String(config.bar?.customTitle || '').trim() || fallbackTitle;
	}

	if (containerId === 'chart-scatter-container') {
		return String(config.scatter?.customTitle || '').trim() || fallbackTitle;
	}

	if (containerId === 'chart-pie-container') {
		return String(config.pie?.customTitle || '').trim() || fallbackTitle;
	}

	if (containerId === 'chart-bubble-container') {
		return String(config.bubble?.customTitle || '').trim() || fallbackTitle;
	}

	if (containerId === 'chart-network-container') {
		return String(config.network?.customTitle || '').trim() || fallbackTitle;
	}

	return fallbackTitle;
}

function buildChartSnapshotMetadata(containerId) {
	const dataset = getActiveDataset();
	const config = dataset?.configGraficos;
	if (!config || !containerId) return {};

	if (containerId === 'chart-bar-container') {
		const category = config.bar?.category || '-';
		return {
			type: 'bar',
			summary: `${t('chive-chart-control-bar-category')}: ${category}`,
		};
	}

	if (containerId === 'chart-scatter-container') {
		const x = config.scatter?.x || '-';
		const y = config.scatter?.y || '-';
		return {
			type: 'scatter',
			summary: `X: ${x} · Y: ${y}`,
		};
	}

	if (containerId === 'chart-pie-container') {
		const pie = config.pie || {};
		const measureLabel = pie.measureMode === 'sum'
			? t('chive-chart-control-pie-measure-sum')
			: t('chive-chart-control-pie-measure-count');
		const category = pie.category || '-';
		const valuePart = pie.measureMode === 'sum'
			? ` · ${t('chive-chart-control-pie-value-column')}: ${pie.valueColumn || '-'}`
			: '';
		const padPart = ` · ${t('chive-chart-control-pie-pad-angle')}: ${Number(pie.padAngle || 0)}deg`;
		return {
			type: 'pie',
			measureMode: pie.measureMode,
			valueColumn: pie.valueColumn || null,
			innerRadius: pie.innerRadius,
			outerRadius: pie.outerRadius,
			padAngle: Number(pie.padAngle || 0),
			labelPosition: pie.labelPosition,
			summary: `${t('chive-chart-control-pie-category')}: ${category} · ${measureLabel}${valuePart}${padPart}`,
		};
	}

	if (containerId === 'chart-bubble-container') {
		const bubble = config.bubble || {};
		const measureLabel = bubble.measureMode === 'sum'
			? t('chive-chart-control-bubble-measure-sum')
			: bubble.measureMode === 'mean'
				? t('chive-chart-control-bubble-measure-mean')
				: t('chive-chart-control-bubble-measure-count');
		const category = bubble.category || '-';
		const valuePart = bubble.measureMode === 'count'
			? ''
			: ` · ${t('chive-chart-control-bubble-value-column')}: ${bubble.valueColumn || '-'}`;
		const groupPart = bubble.groupColumn
			? ` · ${t('chive-chart-control-bubble-group')}: ${bubble.groupColumn}`
			: '';
		const topnPart = ` · ${t('chive-chart-control-bubble-topn')}: ${Number(bubble.topN || 0) === 0 ? t('chive-chart-topn-all') : bubble.topN}`;
		return {
			type: 'bubble',
			category,
			measureMode: bubble.measureMode,
			valueColumn: bubble.valueColumn || null,
			groupColumn: bubble.groupColumn || null,
			topN: bubble.topN,
			summary: `${t('chive-chart-control-bubble-category')}: ${category} · ${measureLabel}${valuePart}${groupPart}${topnPart}`,
		};
	}

	if (containerId === 'chart-network-container') {
		const network = config.network || {};
		const source = network.source || '-';
		const target = network.target || '-';
		return {
			type: 'network',
			source,
			target,
			weight: network.weight || null,
			summary: `${t('chive-chart-control-network-source')}: ${source} · ${t('chive-chart-control-network-target')}: ${target}`,
		};
	}

	return {};
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

	const getLocaleLabel = (locale) => {
		const option = selectLang?.querySelector(`option[value="${locale}"]`);
		return localeLabels[locale] || option?.textContent?.trim() || locale;
	};

	// Update display button text
	const updateDisplay = (locale) => {
		if (langDisplay) {
			langDisplay.textContent = getLocaleLabel(locale);
		}
	};

	selectLang.addEventListener('change', event => {
		const locale = event.target.value;
		updateDisplay(locale);
		setLocale(locale);
	});

	// Update selector on locale change
	window.addEventListener('chive-locale-changed', () => {
		const currentLocale = getLocale();
		selectLang.value = currentLocale;
		updateDisplay(currentLocale);
	});

	// Initialize display with current locale
	const currentLocale = getLocale();
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
