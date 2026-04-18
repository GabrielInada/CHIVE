/**
 * Centralized DOM element ID constants.
 * Prevents typos and provides a single source of truth for element IDs
 * referenced across multiple files.
 */

// Chart containers
export const CHART_CONTAINERS = {
	bar: 'chart-bar-container',
	scatter: 'chart-scatter-container',
	network: 'chart-network-container',
	pie: 'chart-pie-container',
};

// Chart block wrappers (visibility containers)
export const CHART_BLOCKS = {
	bar: 'chart-block-bar',
	scatter: 'chart-block-scatter',
	network: 'chart-block-network',
	pie: 'chart-block-pie',
};

// Panel elements
export const PANEL_IDS = {
	canvas: 'panel-layout-canvas',
	chartList: 'lista-painel-charts',
	layoutSelect: 'select-panel-layout',
	exportButton: 'btn-exportar-painel',
};

// Tab elements
export const TAB_IDS = {
	preview: 'tab-preview',
	charts: 'tab-charts',
	panel: 'tab-panel',
};

// Tab panel containers
export const TAB_PANELS = {
	preview: 'painel-preview',
	charts: 'painel-charts',
	panel: 'painel-panel',
};

// Results/data view elements
export const VIEW_IDS = {
	fileInfo: 'info-arquivo',
	columnPanel: 'painel-colunas',
	emptyState: 'estado-vazio',
	dataState: 'estado-dados',
	resultTabs: 'resultado-tabs',
	tableContainer: 'container-tabela',
	statsContainer: 'container-stats',
	chartsGrid: 'charts-grid',
	chartsEmptyState: 'charts-empty-state',
	statsCard: 'card-stats',
};

// Sidebar elements
export const SIDEBAR_IDS = {
	panelDados: 'sidebar-panel-dados',
	panelViz: 'sidebar-panel-viz',
	panelPanel: 'sidebar-panel-panel',
	toggleButton: 'btn-toggle-sidebar',
};

// Navigation buttons
export const NAV_BUTTONS = {
	advance: 'btn-avancar',
	editColumns: 'btn-editar-colunas',
	goToPanel: 'btn-ir-painel',
	backToViz: 'btn-voltar-viz',
};

// Feedback/status elements
export const FEEDBACK_IDS = {
	toast: 'toast-feedback',
	errorMessage: 'mensagem-erro',
	errorContainer: 'erros-container',
	loadingState: 'loading-estado',
	devWarning: 'aviso-dev',
};

// File management elements
export const FILE_IDS = {
	fileInput: 'input-arquivo',
	uploadZone: 'zona-upload',
	fileSummary: 'arquivo-resumo-texto',
	fileListContent: 'lista-arquivos-conteudo',
};

// Badge elements
export const BADGE_IDS = {
	charts: 'badge-charts',
	rows: 'badge-linhas',
	numColumns: 'badge-num-colunas',
};

// Language elements
export const LANG_IDS = {
	select: 'select-lang',
	display: 'lang-display',
};
