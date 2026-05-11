// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
	filterVisibleColumns: vi.fn(() => [{ nome: 'categoria' }, { nome: 'valor' }]),
	getNumericColumnNames: vi.fn(() => ['valor']),
	getCategoricalColumnNames: vi.fn(() => ['categoria']),
	mergeChartConfigWithDefaults: vi.fn(config => ({
		bar: { enabled: false, expanded: false },
		scatter: { enabled: false, expanded: false },
		pie: { enabled: false, expanded: false },
		bubble: { enabled: false, expanded: false },
		network: { enabled: false, expanded: false },
		treemap: { enabled: false, expanded: false },
		...(config || {}),
	})),
	onStateChange: vi.fn(),
	setActiveChartType: vi.fn(),
	openChartTypePickerDialog: vi.fn(() => Promise.resolve(null)),
	createBarChartControls: vi.fn(() => []),
	setupBarChartControlListeners: vi.fn(),
	createBubbleChartControls: vi.fn(() => []),
	setupBubbleChartControlListeners: vi.fn(),
	createNetworkGraphControls: vi.fn(() => []),
	setupNetworkGraphControlListeners: vi.fn(),
	createScatterPlotControls: vi.fn(() => []),
	setupScatterPlotControlListeners: vi.fn(),
	createPieChartControls: vi.fn(() => []),
	setupPieChartControlListeners: vi.fn(),
	createTreeMapControls: vi.fn(() => []),
	setupTreeMapControlListeners: vi.fn(),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

vi.mock('../../../src/utils/columnHelpers.js', () => ({
	filterVisibleColumns: mocks.filterVisibleColumns,
	getNumericColumnNames: mocks.getNumericColumnNames,
	getCategoricalColumnNames: mocks.getCategoricalColumnNames,
}));

vi.mock('../../../src/config/chartDefaults.js', () => ({
	mergeChartConfigWithDefaults: mocks.mergeChartConfigWithDefaults,
}));

vi.mock('../../../src/modules/appState.js', () => ({
	onStateChange: mocks.onStateChange,
	STATE_EVENTS: { CHART_EXPANDED_CHANGED: 'chartExpandedChanged' },
	setActiveChartType: mocks.setActiveChartType,
}));

vi.mock('../../../src/modules/chart-controls/barControls.js', () => ({
	createBarChartControls: mocks.createBarChartControls,
	setupBarChartControlListeners: mocks.setupBarChartControlListeners,
}));

vi.mock('../../../src/modules/chart-controls/bubbleControls.js', () => ({
	createBubbleChartControls: mocks.createBubbleChartControls,
	setupBubbleChartControlListeners: mocks.setupBubbleChartControlListeners,
}));

vi.mock('../../../src/modules/chart-controls/networkControls.js', () => ({
	createNetworkGraphControls: mocks.createNetworkGraphControls,
	setupNetworkGraphControlListeners: mocks.setupNetworkGraphControlListeners,
}));

vi.mock('../../../src/modules/chart-controls/scatterControls.js', () => ({
	createScatterPlotControls: mocks.createScatterPlotControls,
	setupScatterPlotControlListeners: mocks.setupScatterPlotControlListeners,
}));

vi.mock('../../../src/modules/chart-controls/pieControls.js', () => ({
	createPieChartControls: mocks.createPieChartControls,
	setupPieChartControlListeners: mocks.setupPieChartControlListeners,
}));

vi.mock('../../../src/modules/chart-controls/treemapControls.js', () => ({
	createTreeMapControls: mocks.createTreeMapControls,
	setupTreeMapControlListeners: mocks.setupTreeMapControlListeners,
}));

vi.mock('../../../src/modules/chart-controls/previews.js', () => ({
	PREVIEW_BAR_SVG: '<svg id="prev-bar" />',
	PREVIEW_BUBBLE_SVG: '<svg id="prev-bubble" />',
	PREVIEW_NETWORK_SVG: '<svg id="prev-network" />',
	PREVIEW_PIE_SVG: '<svg id="prev-pie" />',
	PREVIEW_SCATTER_SVG: '<svg id="prev-scatter" />',
	PREVIEW_TREEMAP_SVG: '<svg id="prev-treemap" />',
}));

vi.mock('../../../src/components/results/chartTypePickerDialog.js', () => ({
	openChartTypePickerDialog: mocks.openChartTypePickerDialog,
}));

import {
	renderChartControlsSidebar,
	computeActivationDefaults,
	handleChartTypeSelect,
} from '../../../src/modules/chart-controls/index.js';

function setupSidebarDOM() {
	document.body.innerHTML = `
		<div id="viz-chart-params"></div>
	`;
}

function configWithActive(activeType) {
	return {
		bar: { enabled: activeType === 'bar' },
		scatter: { enabled: activeType === 'scatter' },
		pie: { enabled: activeType === 'pie' },
		bubble: { enabled: activeType === 'bubble' },
		network: { enabled: activeType === 'network' },
		treemap: { enabled: activeType === 'treemap' },
	};
}

describe('renderChartControlsSidebar', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.openChartTypePickerDialog.mockImplementation(() => Promise.resolve(null));
		setupSidebarDOM();
	});

	it('renders a chart-picker trigger inside the params pane', () => {
		renderChartControlsSidebar({ configGraficos: {} });
		const trigger = document.querySelector('#viz-chart-params .viz-chart-picker-trigger');
		expect(trigger).not.toBeNull();
	});

	it('trigger shows placeholder when no chart is active', () => {
		renderChartControlsSidebar({ configGraficos: {} });
		const label = document.querySelector('.viz-chart-picker-trigger-label');
		expect(label?.classList.contains('placeholder')).toBe(true);
	});

	it('trigger shows the active chart name when a chart is active', () => {
		mocks.mergeChartConfigWithDefaults.mockReturnValueOnce(configWithActive('scatter'));
		renderChartControlsSidebar({ configGraficos: {} });
		const label = document.querySelector('.viz-chart-picker-trigger-label');
		expect(label?.classList.contains('placeholder')).toBe(false);
		expect(label?.textContent).toBe('chive-chart-toggle-scatter');
	});

	it('renders only the active chart\'s controls in the params pane', () => {
		mocks.mergeChartConfigWithDefaults.mockReturnValueOnce(configWithActive('scatter'));
		renderChartControlsSidebar({ configGraficos: {} });
		expect(mocks.createScatterPlotControls).toHaveBeenCalledTimes(1);
		expect(mocks.createBarChartControls).not.toHaveBeenCalled();
		expect(mocks.setupScatterPlotControlListeners).toHaveBeenCalledTimes(1);
		expect(mocks.setupBarChartControlListeners).not.toHaveBeenCalled();
	});

	it('shows the params empty-state placeholder when no chart is active', () => {
		renderChartControlsSidebar({ configGraficos: {} });
		const empty = document.querySelector('#viz-chart-params .viz-params-empty');
		expect(empty).not.toBeNull();
		expect(mocks.createBarChartControls).not.toHaveBeenCalled();
		expect(mocks.createScatterPlotControls).not.toHaveBeenCalled();
	});

	it('shows global empty-state when no dataset is provided', () => {
		renderChartControlsSidebar(null);
		const empty = document.querySelector('#viz-chart-params .tabela-sem-colunas');
		expect(empty).not.toBeNull();
		expect(document.querySelector('.viz-chart-picker-trigger')).toBeNull();
	});

	it('clicking the trigger opens the picker with current activeChartType', () => {
		mocks.mergeChartConfigWithDefaults.mockReturnValueOnce(configWithActive('bar'));
		renderChartControlsSidebar({ configGraficos: { bar: { category: 'categoria' } } });
		document.querySelector('.viz-chart-picker-trigger').click();
		expect(mocks.openChartTypePickerDialog).toHaveBeenCalledTimes(1);
		expect(mocks.openChartTypePickerDialog).toHaveBeenCalledWith(
			expect.objectContaining({ activeChartType: 'bar' })
		);
	});

	it('picker resolving with a chartType activates that chart with defaults', async () => {
		mocks.mergeChartConfigWithDefaults.mockReturnValueOnce(configWithActive('bar'));
		mocks.openChartTypePickerDialog.mockReturnValueOnce(Promise.resolve({ chartType: 'scatter' }));
		renderChartControlsSidebar({ configGraficos: { bar: { category: 'categoria' } } });
		document.querySelector('.viz-chart-picker-trigger').click();
		await Promise.resolve();
		await Promise.resolve();
		expect(mocks.setActiveChartType).toHaveBeenCalledWith(
			'scatter',
			expect.objectContaining({ expanded: true })
		);
	});

	it('picker resolving with { chartType: null } deselects', async () => {
		mocks.mergeChartConfigWithDefaults.mockReturnValueOnce(configWithActive('bar'));
		mocks.openChartTypePickerDialog.mockReturnValueOnce(Promise.resolve({ chartType: null }));
		renderChartControlsSidebar({ configGraficos: {} });
		document.querySelector('.viz-chart-picker-trigger').click();
		await Promise.resolve();
		await Promise.resolve();
		expect(mocks.setActiveChartType).toHaveBeenCalledWith(null);
	});

	it('picker resolving with null (cancel) does not change state', async () => {
		mocks.mergeChartConfigWithDefaults.mockReturnValueOnce(configWithActive('bar'));
		mocks.openChartTypePickerDialog.mockReturnValueOnce(Promise.resolve(null));
		renderChartControlsSidebar({ configGraficos: {} });
		document.querySelector('.viz-chart-picker-trigger').click();
		await Promise.resolve();
		await Promise.resolve();
		expect(mocks.setActiveChartType).not.toHaveBeenCalled();
	});

	it('preserves expanded state of control sections across rerenders', () => {
		mocks.mergeChartConfigWithDefaults.mockReturnValue(configWithActive('bar'));

		mocks.createBarChartControls.mockImplementation(() => {
			const section = document.createElement('div');
			section.className = 'chart-control-section';
			section.dataset.section = 'styling';
			const header = document.createElement('button');
			header.className = 'chart-section-header';
			header.setAttribute('aria-expanded', 'false');
			const toggleIcon = document.createElement('span');
			toggleIcon.className = 'chart-section-toggle';
			toggleIcon.textContent = '▶';
			header.appendChild(toggleIcon);
			const content = document.createElement('div');
			content.className = 'chart-section-content';
			content.style.display = 'none';
			section.appendChild(header);
			section.appendChild(content);
			return [section];
		});

		renderChartControlsSidebar({ configGraficos: {} });

		const header = document.querySelector('.chart-control-section[data-section="styling"] .chart-section-header');
		const content = document.querySelector('.chart-control-section[data-section="styling"] .chart-section-content');
		const toggleIcon = document.querySelector('.chart-control-section[data-section="styling"] .chart-section-toggle');
		header.setAttribute('aria-expanded', 'true');
		content.style.display = 'block';
		toggleIcon.textContent = '▼';

		renderChartControlsSidebar({ configGraficos: {} });

		const nextHeader = document.querySelector('.chart-control-section[data-section="styling"] .chart-section-header');
		const nextContent = document.querySelector('.chart-control-section[data-section="styling"] .chart-section-content');
		const nextToggle = document.querySelector('.chart-control-section[data-section="styling"] .chart-section-toggle');
		expect(nextHeader?.getAttribute('aria-expanded')).toBe('true');
		expect(nextContent?.style.display).toBe('block');
		expect(nextToggle?.textContent).toBe('▼');
	});
});

describe('computeActivationDefaults', () => {
	const numericas = ['n1', 'n2'];
	const categoricas = ['c1', 'c2'];
	const todasColunas = ['c1', 'c2', 'n1', 'n2'];

	function makeDataset(config = {}) {
		return { configGraficos: config };
	}

	it('bar: picks first categorical when current is invalid', () => {
		const defaults = computeActivationDefaults('bar', makeDataset(), { numericas, categoricas, todasColunas });
		expect(defaults).toEqual({ category: 'c1' });
	});

	it('bar: keeps current category when still valid', () => {
		const defaults = computeActivationDefaults(
			'bar',
			makeDataset({ bar: { category: 'c2' } }),
			{ numericas, categoricas, todasColunas }
		);
		expect(defaults).toEqual({ category: 'c2' });
	});

	it('scatter: prefers two numeric columns and forces linear scale on categorical fallback', () => {
		const defaults = computeActivationDefaults(
			'scatter',
			makeDataset({ scatter: { xScale: 'log', yScale: 'log' } }),
			{ numericas, categoricas, todasColunas }
		);
		expect(defaults.x).toBe('n1');
		expect(defaults.y).toBe('n2');
		expect(defaults.xScale).toBe('log');
		expect(defaults.yScale).toBe('log');
	});

	it('scatter: falls back to categorical and forces linear when no numerics', () => {
		const defaults = computeActivationDefaults(
			'scatter',
			makeDataset({ scatter: { xScale: 'log', yScale: 'log' } }),
			{ numericas: [], categoricas, todasColunas: categoricas }
		);
		expect(defaults.xScale).toBe('linear');
		expect(defaults.yScale).toBe('linear');
		expect(defaults.x).not.toBeNull();
		expect(defaults.y).not.toBeNull();
		expect(defaults.x).not.toBe(defaults.y);
	});

	it('pie: returns category + first-numeric valueColumn', () => {
		const defaults = computeActivationDefaults('pie', makeDataset(), { numericas, categoricas, todasColunas });
		expect(defaults).toEqual({ category: 'c1', valueColumn: 'n1' });
	});

	it('network: picks source and target from todasColunas', () => {
		const defaults = computeActivationDefaults('network', makeDataset(), { numericas, categoricas, todasColunas });
		expect(defaults.source).toBe('c1');
		expect(defaults.target).toBe('c2');
	});

	it('bubble: respects measureMode=count by leaving valueColumn alone', () => {
		const defaults = computeActivationDefaults(
			'bubble',
			makeDataset({ bubble: { measureMode: 'count', valueColumn: 'unused' } }),
			{ numericas, categoricas, todasColunas }
		);
		expect(defaults.valueColumn).toBe('unused');
	});

	it('treemap: picks first categorical', () => {
		const defaults = computeActivationDefaults('treemap', makeDataset(), { numericas, categoricas, todasColunas });
		expect(defaults).toEqual({ category: 'c1' });
	});

	it('returns {} for unknown chart types', () => {
		const defaults = computeActivationDefaults('histogram', makeDataset(), { numericas, categoricas, todasColunas });
		expect(defaults).toEqual({});
	});
});

describe('handleChartTypeSelect', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('calls setActiveChartType(null) when given null', () => {
		handleChartTypeSelect(null, { configGraficos: {} });
		expect(mocks.setActiveChartType).toHaveBeenCalledWith(null);
	});

	it('forwards computed defaults + expanded:true when activating a chart', () => {
		handleChartTypeSelect('bar', { configGraficos: {} });
		expect(mocks.setActiveChartType).toHaveBeenCalledWith(
			'bar',
			expect.objectContaining({ category: 'categoria', expanded: true })
		);
	});
});
