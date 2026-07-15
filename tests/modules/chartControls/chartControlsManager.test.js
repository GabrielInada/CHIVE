// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
	filterVisibleColumns: vi.fn(() => [{ name: 'categoria' }, { name: 'valor' }]),
	getNumericColumnNames: vi.fn(() => ['valor']),
	getCategoricalColumnNames: vi.fn(() => ['categoria']),
	getDateColumnNames: vi.fn(() => []),
	mergeChartConfigWithDefaults: vi.fn(config => ({
		bar: { enabled: false, expanded: false },
		scatter: { enabled: false, expanded: false },
		pie: { enabled: false, expanded: false },
		bubble: { enabled: false, expanded: false },
		network: { enabled: false, expanded: false },
		treemap: { enabled: false, expanded: false },
		line: { enabled: false, expanded: false },
		tin: { enabled: false, expanded: false },
		scatter3d: { enabled: false, expanded: false },
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
	createLineChartControls: vi.fn(() => []),
	setupLineChartControlListeners: vi.fn(),
	createTinControls: vi.fn(() => []),
	setupTinControlListeners: vi.fn(),
	createScatter3dControls: vi.fn(() => []),
	setupScatter3dControlListeners: vi.fn(),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

vi.mock('../../../src/utils/columnHelpers.js', () => ({
	filterVisibleColumns: mocks.filterVisibleColumns,
	getNumericColumnNames: mocks.getNumericColumnNames,
	getCategoricalColumnNames: mocks.getCategoricalColumnNames,
	getDateColumnNames: mocks.getDateColumnNames,
}));

vi.mock('../../../src/config/chartDefaults.js', () => ({
	mergeChartConfigWithDefaults: mocks.mergeChartConfigWithDefaults,
}));

vi.mock('../../../src/state/appState.js', () => ({
	onStateChange: mocks.onStateChange,
	STATE_EVENTS: {},
	setActiveChartType: mocks.setActiveChartType,
}));

vi.mock('../../../src/charts/bar/controls/builder.js', () => ({
	createBarChartControls: mocks.createBarChartControls,
}));
vi.mock('../../../src/charts/bar/controls/listeners.js', () => ({
	setupBarChartControlListeners: mocks.setupBarChartControlListeners,
}));

vi.mock('../../../src/charts/bubble/controls/builder.js', () => ({
	createBubbleChartControls: mocks.createBubbleChartControls,
}));
vi.mock('../../../src/charts/bubble/controls/listeners.js', () => ({
	setupBubbleChartControlListeners: mocks.setupBubbleChartControlListeners,
}));

vi.mock('../../../src/charts/network/controls/builder.js', () => ({
	createNetworkGraphControls: mocks.createNetworkGraphControls,
}));
vi.mock('../../../src/charts/network/controls/listeners.js', () => ({
	setupNetworkGraphControlListeners: mocks.setupNetworkGraphControlListeners,
}));

vi.mock('../../../src/charts/scatter/controls/builder.js', () => ({
	createScatterPlotControls: mocks.createScatterPlotControls,
}));
vi.mock('../../../src/charts/scatter/controls/listeners.js', () => ({
	setupScatterPlotControlListeners: mocks.setupScatterPlotControlListeners,
}));

vi.mock('../../../src/charts/pie/controls/builder.js', () => ({
	createPieChartControls: mocks.createPieChartControls,
}));
vi.mock('../../../src/charts/pie/controls/listeners.js', () => ({
	setupPieChartControlListeners: mocks.setupPieChartControlListeners,
}));

vi.mock('../../../src/charts/treemap/controls/builder.js', () => ({
	createTreeMapControls: mocks.createTreeMapControls,
}));
vi.mock('../../../src/charts/treemap/controls/listeners.js', () => ({
	setupTreeMapControlListeners: mocks.setupTreeMapControlListeners,
}));

vi.mock('../../../src/charts/line/controls/builder.js', () => ({
	createLineChartControls: mocks.createLineChartControls,
}));
vi.mock('../../../src/charts/line/controls/listeners.js', () => ({
	setupLineChartControlListeners: mocks.setupLineChartControlListeners,
}));

vi.mock('../../../src/charts/tin/controls/builder.js', () => ({
	createTinControls: mocks.createTinControls,
}));
vi.mock('../../../src/charts/tin/controls/listeners.js', () => ({
	setupTinControlListeners: mocks.setupTinControlListeners,
}));

vi.mock('../../../src/charts/scatter3d/controls/builder.js', () => ({
	createScatter3dControls: mocks.createScatter3dControls,
}));
vi.mock('../../../src/charts/scatter3d/controls/listeners.js', () => ({
	setupScatter3dControlListeners: mocks.setupScatter3dControlListeners,
}));

vi.mock('../../../src/charts/previews.js', () => ({
	PREVIEW_BAR_SVG: '<svg id="prev-bar" />',
	PREVIEW_BUBBLE_SVG: '<svg id="prev-bubble" />',
	PREVIEW_NETWORK_SVG: '<svg id="prev-network" />',
	PREVIEW_PIE_SVG: '<svg id="prev-pie" />',
	PREVIEW_SCATTER_SVG: '<svg id="prev-scatter" />',
	PREVIEW_TREEMAP_SVG: '<svg id="prev-treemap" />',
	PREVIEW_LINE_SVG: '<svg id="prev-line" />',
	PREVIEW_TIN_SVG: '<svg id="prev-tin" />',
	PREVIEW_SCATTER3D_SVG: '<svg id="prev-scatter3d" />',
}));

vi.mock('../../../src/features/datasetWorkspace/dialogs/chartTypePickerDialog.js', () => ({
	openChartTypePickerDialog: mocks.openChartTypePickerDialog,
}));

import {
	renderChartControlsSidebar,
	computeActivationDefaults,
	handleChartTypeSelect,
} from '../../../src/modules/chartControls/chartControlsManager.js';
import { getChartControlAdapter } from '../../../src/charts/registries/controls.js';

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
		line: { enabled: activeType === 'line' },
		tin: { enabled: activeType === 'tin' },
		scatter3d: { enabled: activeType === 'scatter3d' },
	};
}

describe('controls registry', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns null for unknown and inherited keys', () => {
		expect(getChartControlAdapter('histogram')).toBeNull();
		expect(getChartControlAdapter('__proto__')).toBeNull();
	});

	it.each([
		['bar', 'createBarChartControls', 'setupBarChartControlListeners', ['base', 'numeric', 'all'], ['base', 'numeric', 'all']],
		['line', 'createLineChartControls', 'setupLineChartControlListeners', ['numeric', 'dates', 'all'], ['numeric', 'dates', 'all']],
		['scatter', 'createScatterPlotControls', 'setupScatterPlotControlListeners', ['numeric', 'all'], ['numeric', 'all']],
		['scatter3d', 'createScatter3dControls', 'setupScatter3dControlListeners', ['numeric', 'all'], ['numeric', 'all']],
		['pie', 'createPieChartControls', 'setupPieChartControlListeners', ['base', 'numeric', 'all'], ['base', 'numeric', 'all']],
		['bubble', 'createBubbleChartControls', 'setupBubbleChartControlListeners', ['base', 'numeric', 'all'], ['base', 'numeric', 'all']],
		['network', 'createNetworkGraphControls', 'setupNetworkGraphControlListeners', ['all', 'numeric', 'categorical'], ['all', 'numeric']],
		['treemap', 'createTreeMapControls', 'setupTreeMapControlListeners', ['base', 'numeric', 'all'], ['base', 'numeric', 'all']],
		['tin', 'createTinControls', 'setupTinControlListeners', ['numeric', 'all'], ['numeric', 'all']],
	])('preserves the %s controls adapter signatures', (type, buildMock, listenerMock, buildKeys, listenerKeys) => {
		const dataset = { chartConfig: {} };
		const callback = vi.fn();
		const values = {
			base: ['category'],
			numeric: ['value'],
			categorical: ['category'],
			dates: ['date'],
			all: ['category', 'value', 'date'],
		};
		const context = {
			baseCategoricalOrAll: values.base,
			numeric: values.numeric,
			categorical: values.categorical,
			dates: values.dates,
			allColumns: values.all,
		};
		const adapter = getChartControlAdapter(type);

		adapter.build(dataset, context);
		adapter.attachListeners(dataset, context, callback);

		expect(mocks[buildMock]).toHaveBeenCalledWith(
			dataset,
			...buildKeys.map(key => values[key]),
		);
		expect(mocks[listenerMock]).toHaveBeenCalledWith(
			dataset,
			...listenerKeys.map(key => values[key]),
			callback,
		);
	});
});

describe('renderChartControlsSidebar', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.openChartTypePickerDialog.mockImplementation(() => Promise.resolve(null));
		setupSidebarDOM();
	});

	it('renders a chart-picker trigger inside the params pane', () => {
		renderChartControlsSidebar({ chartConfig: {} });
		const trigger = document.querySelector('#viz-chart-params .viz-chart-picker-trigger');
		expect(trigger).not.toBeNull();
	});

	it('trigger shows placeholder when no chart is active', () => {
		renderChartControlsSidebar({ chartConfig: {} });
		const label = document.querySelector('.viz-chart-picker-trigger-label');
		expect(label?.classList.contains('placeholder')).toBe(true);
	});

	it('trigger shows the active chart name when a chart is active', () => {
		mocks.mergeChartConfigWithDefaults.mockReturnValueOnce(configWithActive('scatter'));
		renderChartControlsSidebar({ chartConfig: {} });
		const label = document.querySelector('.viz-chart-picker-trigger-label');
		expect(label?.classList.contains('placeholder')).toBe(false);
		expect(label?.textContent).toBe('chive-chart-toggle-scatter');
	});

	it('renders only the active chart\'s controls in the params pane', () => {
		mocks.mergeChartConfigWithDefaults.mockReturnValueOnce(configWithActive('scatter'));
		renderChartControlsSidebar({ chartConfig: {} });
		expect(mocks.createScatterPlotControls).toHaveBeenCalledTimes(1);
		expect(mocks.createBarChartControls).not.toHaveBeenCalled();
		expect(mocks.setupScatterPlotControlListeners).toHaveBeenCalledTimes(1);
		expect(mocks.setupBarChartControlListeners).not.toHaveBeenCalled();
	});

	it.each([
		['pie', 'createPieChartControls', 'setupPieChartControlListeners'],
		['bubble', 'createBubbleChartControls', 'setupBubbleChartControlListeners'],
		['network', 'createNetworkGraphControls', 'setupNetworkGraphControlListeners'],
		['treemap', 'createTreeMapControls', 'setupTreeMapControlListeners'],
		['line', 'createLineChartControls', 'setupLineChartControlListeners'],
		['tin', 'createTinControls', 'setupTinControlListeners'],
		['scatter3d', 'createScatter3dControls', 'setupScatter3dControlListeners'],
	])('renders and wires %s controls through the registry', (chartType, buildMock, listenerMock) => {
		mocks.mergeChartConfigWithDefaults.mockReturnValueOnce(configWithActive(chartType));

		renderChartControlsSidebar({ chartConfig: {} });

		expect(mocks[buildMock]).toHaveBeenCalledTimes(1);
		expect(mocks[listenerMock]).toHaveBeenCalledTimes(1);
	});

	it('shows the params empty-state placeholder when no chart is active', () => {
		renderChartControlsSidebar({ chartConfig: {} });
		const empty = document.querySelector('#viz-chart-params .viz-params-empty');
		expect(empty).not.toBeNull();
		expect(mocks.createBarChartControls).not.toHaveBeenCalled();
		expect(mocks.createScatterPlotControls).not.toHaveBeenCalled();
	});

	it('shows global empty-state when no dataset is provided', () => {
		renderChartControlsSidebar(null);
		const empty = document.querySelector('#viz-chart-params .table-no-columns');
		expect(empty).not.toBeNull();
		expect(document.querySelector('.viz-chart-picker-trigger')).toBeNull();
	});

	it('shows global empty-state when every column is hidden', () => {
		mocks.filterVisibleColumns.mockReturnValueOnce([]);

		renderChartControlsSidebar({ chartConfig: {} });

		const empty = document.querySelector('#viz-chart-params .table-no-columns');
		expect(empty).not.toBeNull();
		expect(empty?.textContent).toBe('chive-chart-sidebar-empty');
		expect(mocks.mergeChartConfigWithDefaults).not.toHaveBeenCalled();
	});

	it('clicking the trigger opens the picker with current activeChartType', () => {
		mocks.mergeChartConfigWithDefaults.mockReturnValueOnce(configWithActive('bar'));
		renderChartControlsSidebar({ chartConfig: { bar: { category: 'categoria' } } });
		document.querySelector('.viz-chart-picker-trigger').click();
		expect(mocks.openChartTypePickerDialog).toHaveBeenCalledTimes(1);
		expect(mocks.openChartTypePickerDialog).toHaveBeenCalledWith(
			expect.objectContaining({ activeChartType: 'bar' })
		);
	});

	it('picker resolving with a chartType activates that chart with defaults', async () => {
		mocks.mergeChartConfigWithDefaults.mockReturnValueOnce(configWithActive('bar'));
		mocks.openChartTypePickerDialog.mockReturnValueOnce(Promise.resolve({ chartType: 'scatter' }));
		renderChartControlsSidebar({ chartConfig: { bar: { category: 'categoria' } } });
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
		renderChartControlsSidebar({ chartConfig: {} });
		document.querySelector('.viz-chart-picker-trigger').click();
		await Promise.resolve();
		await Promise.resolve();
		expect(mocks.setActiveChartType).toHaveBeenCalledWith(null);
	});

	it('picker resolving with null (cancel) does not change state', async () => {
		mocks.mergeChartConfigWithDefaults.mockReturnValueOnce(configWithActive('bar'));
		mocks.openChartTypePickerDialog.mockReturnValueOnce(Promise.resolve(null));
		renderChartControlsSidebar({ chartConfig: {} });
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

		renderChartControlsSidebar({ chartConfig: {} });

		const header = document.querySelector('.chart-control-section[data-section="styling"] .chart-section-header');
		const content = document.querySelector('.chart-control-section[data-section="styling"] .chart-section-content');
		const toggleIcon = document.querySelector('.chart-control-section[data-section="styling"] .chart-section-toggle');
		header.setAttribute('aria-expanded', 'true');
		content.style.display = 'block';
		toggleIcon.textContent = '▼';

		renderChartControlsSidebar({ chartConfig: {} });

		const nextHeader = document.querySelector('.chart-control-section[data-section="styling"] .chart-section-header');
		const nextContent = document.querySelector('.chart-control-section[data-section="styling"] .chart-section-content');
		const nextToggle = document.querySelector('.chart-control-section[data-section="styling"] .chart-section-toggle');
		expect(nextHeader?.getAttribute('aria-expanded')).toBe('true');
		expect(nextContent?.style.display).toBe('block');
		expect(nextToggle?.textContent).toBe('▼');
	});
});

describe('computeActivationDefaults', () => {
	const numeric = ['n1', 'n2'];
	const categorical = ['c1', 'c2'];
	const allColumns = ['c1', 'c2', 'n1', 'n2'];

	function makeDataset(config = {}) {
		return { chartConfig: config };
	}

	it('bar: picks first categorical when current is invalid', () => {
		const defaults = computeActivationDefaults('bar', makeDataset(), { numeric, categorical, allColumns });
		expect(defaults).toEqual({ category: 'c1' });
	});

	it('bar: keeps current category when still valid', () => {
		const defaults = computeActivationDefaults(
			'bar',
			makeDataset({ bar: { category: 'c2' } }),
			{ numeric, categorical, allColumns }
		);
		expect(defaults).toEqual({ category: 'c2' });
	});

	it('scatter: prefers two numeric columns and forces linear scale on categorical fallback', () => {
		const defaults = computeActivationDefaults(
			'scatter',
			makeDataset({ scatter: { xScale: 'log', yScale: 'log' } }),
			{ numeric, categorical, allColumns }
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
			{ numeric: [], categorical, allColumns: categorical }
		);
		expect(defaults.xScale).toBe('linear');
		expect(defaults.yScale).toBe('linear');
		expect(defaults.x).not.toBeNull();
		expect(defaults.y).not.toBeNull();
		expect(defaults.x).not.toBe(defaults.y);
	});

	it('pie: returns category + first-numeric valueColumn', () => {
		const defaults = computeActivationDefaults('pie', makeDataset(), { numeric, categorical, allColumns });
		expect(defaults).toEqual({ category: 'c1', valueColumn: 'n1' });
	});

	it('network: picks source and target from allColumns', () => {
		const defaults = computeActivationDefaults('network', makeDataset(), { numeric, categorical, allColumns });
		expect(defaults.source).toBe('c1');
		expect(defaults.target).toBe('c2');
	});

	it('bubble: respects measureMode=count by leaving valueColumn alone', () => {
		const defaults = computeActivationDefaults(
			'bubble',
			makeDataset({ bubble: { measureMode: 'count', valueColumn: 'unused' } }),
			{ numeric, categorical, allColumns }
		);
		expect(defaults.valueColumn).toBe('unused');
	});

	it('treemap: picks first categorical', () => {
		const defaults = computeActivationDefaults('treemap', makeDataset(), { numeric, categorical, allColumns });
		expect(defaults).toEqual({ category: 'c1' });
	});

	it('returns {} for unknown chart types', () => {
		const defaults = computeActivationDefaults('histogram', makeDataset(), { numeric, categorical, allColumns });
		expect(defaults).toEqual({});
	});
});

describe('handleChartTypeSelect', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('calls setActiveChartType(null) when given null', () => {
		handleChartTypeSelect(null, { chartConfig: {} });
		expect(mocks.setActiveChartType).toHaveBeenCalledWith(null);
	});

	it('forwards computed defaults + expanded:true when activating a chart', () => {
		handleChartTypeSelect('bar', { chartConfig: {} });
		expect(mocks.setActiveChartType).toHaveBeenCalledWith(
			'bar',
			expect.objectContaining({ category: 'categoria', expanded: true })
		);
	});
});
