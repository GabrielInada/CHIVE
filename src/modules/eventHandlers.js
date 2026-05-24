/**
 * CHIVE Event Handlers.
 *
 * Coordinates all application event listeners:
 *   - Chart action buttons (download SVG, add-to-panel)
 *   - Sidebar navigation buttons
 *   - Tab navigation
 *   - Sidebar toggle
 *   - Panel layout/export controls
 *   - Global keyboard shortcuts
 *   - Dataset row interactions
 */

import { t } from '../services/i18nService.js';
import { downloadSvgFromContainer } from '../utils/svgExport.js';
import { addChartToPanel, setupPanelEventListeners } from './panelManager.js';
import { showError, showFeedback } from './feedbackUI.js';
import { setupFileInputListeners, selectDataset, removeDatasetByIndex } from './fileManager.js';
import { setupTabListeners, setupSidebarToggleListener, switchTab } from './uiManager.js';
import { getActiveDataset, updateActiveDatasetConfig } from './state/appState.js';
import { CHART_CONTAINERS } from '../config/elementIds.js';

const CONTAINER_ID_TO_CHART_TYPE = Object.fromEntries(
	Object.entries(CHART_CONTAINERS).map(([type, id]) => [id, type])
);

/**
 * Wire all DOM listeners. Calls eight setup functions in sequence:
 *   - `setupFileInputListeners` (fileManager)
 *   - `setupTabListeners` (uiManager)
 *   - `setupSidebarToggleListener` (uiManager)
 *   - `setupSidebarNavigationButtons` (here, private)
 *   - `setupPanelEventListeners` (panelManager)
 *   - `setupChartActionListeners` (here, private — download SVG + add-to-panel buttons)
 *   - `setupGlobalKeyboardListeners` (here, private — Esc + Ctrl/Cmd+O)
 *   - `setupDatasetListeners` (here, private — delegated select/remove)
 *
 * Called once during app startup from `main.js`.
 */
export function initializeAllEventHandlers() {
	setupFileInputListeners();
	setupTabListeners();
	setupSidebarToggleListener();
	setupSidebarNavigationButtons();
	setupPanelEventListeners();
	setupChartActionListeners();
	setupGlobalKeyboardListeners();
	setupDatasetListeners();
}

/**
 * Setup sidebar navigation buttons
 * @private
 */
function setupSidebarNavigationButtons() {
	const btnAvancar = document.getElementById('btn-advance');
	const btnEditarColunas = document.getElementById('btn-edit-columns');
	const btnIrPainel = document.getElementById('btn-go-to-panel');
	const btnVoltarViz = document.getElementById('btn-back-to-viz');

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
 * Setup chart action button listeners
 * Handles: Download SVG, Add to Panel
 * @private
 */
function setupChartActionListeners() {
	document.addEventListener('click', event => {
		const actionBtn = event.target.closest('[data-chart-action]');
		if (!actionBtn) return;
		handleChartAction(actionBtn);
	});
}

/**
 * Handle chart action (download-svg or add-panel)
 * @private
 */
function handleChartAction(actionBtn) {
	const action = actionBtn.dataset.chartAction;
	const containerId = actionBtn.dataset.chartContainer;

	if (action === 'download-svg') {
		const filename = actionBtn.dataset.chartFilename || 'chart';
		const result = downloadSvgFromContainer(containerId, filename);
		if (!result.ok) {
			showError(t('chive-chart-download-error'));
		}
	} else if (action === 'add-panel') {
		const chartBlock = actionBtn.closest('.chart-block');
		const fallbackTitle = chartBlock?.querySelector('.chart-title')?.textContent?.trim()
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

/**
 * Map from `ChartTypeKey` → builder function that derives the snapshot
 * metadata (and a short `summary` string) from the active dataset's
 * `configGraficos`. Consumed by {@link buildChartSnapshotMetadata} when
 * an "add to panel" button is clicked.
 *
 * Each builder returns at minimum `{ type, summary }`; chart-specific
 * builders may include axis bindings or config snapshots used by the
 * panel renderer.
 *
 * @private
 */
const CHART_SNAPSHOT_BUILDERS = {
	bar: (config) => {
		const category = config.bar?.category || '-';
		return {
			type: 'bar',
			summary: `${t('chive-chart-control-bar-category')}: ${category}`,
		};
	},

	scatter: (config) => {
		const x = config.scatter?.x || '-';
		const y = config.scatter?.y || '-';
		return {
			type: 'scatter',
			summary: `X: ${x} · Y: ${y}`,
		};
	},

	pie: (config) => {
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
	},

	bubble: (config) => {
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
	},

	network: (config) => {
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
	},

	treemap: (config) => {
		const treemap = config.treemap || {};
		const measureLabel = treemap.measureMode === 'sum'
			? t('chive-chart-control-bar-measure-sum')
			: t('chive-chart-control-bar-measure-count');
		const category = treemap.category || '-';
		const valuePart = treemap.measureMode === 'sum'
			? ` · ${t('chive-chart-control-treemap-value-column')}: ${treemap.valueColumn || '-'}`
			: '';
		return {
			type: 'treemap',
			category,
			measureMode: treemap.measureMode,
			valueColumn: treemap.valueColumn || null,
			topN: treemap.topN,
			summary: `${t('chive-chart-control-treemap-category')}: ${category} · ${measureLabel}${valuePart}`,
		};
	},

	line: (config) => {
		const line = config.line || {};
		const x = line.x || '-';
		const y = line.y || '-';
		return {
			type: 'line',
			x,
			y,
			curve: line.curve || null,
			summary: `${t('chive-chart-control-line-x')}: ${x} · ${t('chive-chart-control-line-y')}: ${y}`,
		};
	},

	tin: (config) => {
		const tin = config.tin || {};
		const x = tin.x || '-';
		const y = tin.y || '-';
		const z = tin.z || '-';
		return {
			type: 'tin',
			x,
			y,
			z,
			summary: `${t('chive-chart-control-tin-x')}: ${x} · ${t('chive-chart-control-tin-y')}: ${y} · ${t('chive-chart-control-tin-z')}: ${z}`,
		};
	},
};

/**
 * Resolve the snapshot title: prefer the user's `customTitle` for the
 * chart type behind `containerId`, falling back to `fallbackTitle`.
 *
 * @private
 */
function getChartSnapshotTitle(containerId, fallbackTitle) {
	const type = CONTAINER_ID_TO_CHART_TYPE[containerId];
	if (!type) return fallbackTitle;
	const config = getActiveDataset()?.configGraficos || {};
	return String(config[type]?.customTitle || '').trim() || fallbackTitle;
}

/**
 * Build the metadata object for an `addChartToPanel` call from the
 * active dataset's current config. Returns `{}` when the type or config
 * cannot be resolved.
 *
 * @private
 */
function buildChartSnapshotMetadata(containerId) {
	const type = CONTAINER_ID_TO_CHART_TYPE[containerId];
	const config = getActiveDataset()?.configGraficos;
	if (!type || !config) return {};
	const builder = CHART_SNAPSHOT_BUILDERS[type];
	return builder ? builder(config) : {};
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
			document.getElementById('file-input')?.click();
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
 * Wire delegated listeners on the results view (column list, column
 * action buttons). Note: the inner callbacks reference TODO comments
 * pointing at `resultsView.js` for the actual wiring — this function
 * currently sets up the delegation skeleton but the callbacks are not
 * yet routed. Tracked as a follow-up refactor; documented as-is.
 */
export function setupResultsViewListeners() {
	// Column selection
	const listaColunas = document.getElementById('column-list-content');
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
