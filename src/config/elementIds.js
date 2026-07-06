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
	bubble: 'chart-bubble-container',
	treemap: 'chart-treemap-container',
	line: 'chart-line-container',
	tin: 'chart-tin-container',
	scatter3d: 'chart-scatter3d-container',
};

// Chart block wrappers (visibility containers)
export const CHART_BLOCKS = {
	bar: 'chart-block-bar',
	scatter: 'chart-block-scatter',
	network: 'chart-block-network',
	pie: 'chart-block-pie',
	bubble: 'chart-block-bubble',
	treemap: 'chart-block-treemap',
	line: 'chart-block-line',
	tin: 'chart-block-tin',
	scatter3d: 'chart-block-scatter3d',
};

// Panel elements
export const PANEL_IDS = {
	canvas: 'panel-layout-canvas',
	chartList: 'panel-chart-list',
	layoutSelect: 'select-panel-layout',
	exportButton: 'btn-export-panel',
};

// Tab elements
export const TAB_IDS = {
	preview: 'tab-preview',
	charts: 'tab-charts',
	panel: 'tab-panel',
};

// Tab panel containers
export const TAB_PANELS = {
	preview: 'tab-content-preview',
	charts: 'tab-content-charts',
	panel: 'tab-content-dashboard',
};

// Results/data view elements
export const VIEW_IDS = {
	fileInfo: 'file-info',
	columnPanel: 'columns-panel',
	emptyState: 'empty-state',
	dataState: 'data-state',
	resultTabs: 'result-tabs',
	tableContainer: 'table-container',
	statsContainer: 'container-stats',
	chartsGrid: 'charts-grid',
	chartsEmptyState: 'charts-empty-state',
	statsCard: 'card-stats',
};

// Sidebar elements
export const SIDEBAR_IDS = {
	panelData: 'sidebar-panel-data',
	panelViz: 'sidebar-panel-viz',
	panelDashboard: 'sidebar-panel-dashboard',
	toggleButton: 'btn-toggle-sidebar',
};

// Navigation buttons
export const NAV_BUTTONS = {
	advance: 'btn-advance',
	editColumns: 'btn-edit-columns',
	goToPanel: 'btn-go-to-panel',
	backToViz: 'btn-back-to-viz',
};

// Feedback/status elements
export const FEEDBACK_IDS = {
	toast: 'toast-feedback',
	errorMessage: 'error-message',
	errorContainer: 'errors-container',
	loadingState: 'loading-state',
	devWarning: 'dev-warning',
};

// File management elements
export const FILE_IDS = {
	fileInput: 'file-input',
	projectImportInput: 'project-import-input',
	projectMenuButton: 'btn-project-menu',
	projectMenuPanel: 'project-menu-panel',
	projectExportButton: 'btn-project-export',
	projectExportWorkOnlyButton: 'btn-project-export-work-only',
	projectImportButton: 'btn-project-import',
	uploadZone: 'upload-zone',
	fileSummary: 'file-summary-text',
	fileListContent: 'file-list-content',
};

// Badge elements
export const BADGE_IDS = {
	charts: 'badge-charts',
	rows: 'badge-rows',
	numColumns: 'badge-num-columns',
};

// Language elements
export const LANG_IDS = {
	select: 'select-lang',
	display: 'lang-display',
};
