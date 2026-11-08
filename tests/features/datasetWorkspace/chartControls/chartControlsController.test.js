// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
	onStateChange: vi.fn(),
	setActiveChartType: vi.fn(),
	openChartTypePickerDialog: vi.fn(() => Promise.resolve(null)),
	createScatterPlotControls: vi.fn(() => []),
	setupScatterPlotControlListeners: vi.fn(),
}));

vi.mock('../../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

vi.mock('../../../../src/state/appState.js', () => ({
	onStateChange: mocks.onStateChange,
	STATE_EVENTS: {},
	setActiveChartType: mocks.setActiveChartType,
}));

vi.mock('../../../../src/charts/scatter/controls/builder.js', () => ({
	createScatterPlotControls: mocks.createScatterPlotControls,
}));
vi.mock('../../../../src/charts/scatter/controls/listeners.js', () => ({
	setupScatterPlotControlListeners: mocks.setupScatterPlotControlListeners,
}));

vi.mock('../../../../src/charts/previews.js', () => ({
	CHART_PREVIEWS: {
		bar: '<svg id="prev-bar" />',
		line: '<svg id="prev-line" />',
		scatter: '<svg id="prev-scatter" />',
		scatter3d: '<svg id="prev-scatter3d" />',
		pie: '<svg id="prev-pie" />',
		bubble: '<svg id="prev-bubble" />',
		network: '<svg id="prev-network" />',
		treemap: '<svg id="prev-treemap" />',
		tin: '<svg id="prev-tin" />',
	},
}));

vi.mock('../../../../src/features/datasetWorkspace/dialogs/chartTypePickerDialog.js', () => ({
	openChartTypePickerDialog: mocks.openChartTypePickerDialog,
}));

import {
	renderChartControlsSidebar,
	computeActivationDefaults,
	handleChartTypeSelect,
} from '../../../../src/features/datasetWorkspace/chartControls/chartControlsController.js';
import { deriveShownDataset } from '../../../../src/domain/datasets/shownDataset.js';

function setupSidebarDOM() {
	document.body.innerHTML = `
		<div id="viz-chart-params"></div>
	`;
}

const COLUMNS = [{ name: 'categoria', type: 'text' }, { name: 'valor', type: 'number' }];

/** The shown dataset for a dataset with `activeType` enabled. */
function shownFor(activeType = null, { selectedColumns = ['categoria', 'valor'], chartConfig = {} } = {}) {
	return deriveShownDataset({
		rows: [{ categoria: 'A', valor: 1 }],
		columns: COLUMNS,
		selectedColumns,
		chartConfig: { ...configWithActive(activeType), ...chartConfig },
	});
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

describe('renderChartControlsSidebar', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.openChartTypePickerDialog.mockImplementation(() => Promise.resolve(null));
		setupSidebarDOM();
	});

	it('renders a chart-picker trigger inside the params pane', () => {
		renderChartControlsSidebar(shownFor());
		const trigger = document.querySelector('#viz-chart-params .viz-chart-picker-trigger');
		expect(trigger).not.toBeNull();
	});

	it('trigger shows placeholder when no chart is active', () => {
		renderChartControlsSidebar(shownFor());
		const label = document.querySelector('.viz-chart-picker-trigger-label');
		expect(label?.classList.contains('placeholder')).toBe(true);
	});

	it('trigger shows the active chart name when a chart is active', () => {
		renderChartControlsSidebar(shownFor('scatter'));
		const label = document.querySelector('.viz-chart-picker-trigger-label');
		expect(label?.classList.contains('placeholder')).toBe(false);
		expect(label?.textContent).toBe('chive-chart-toggle-scatter');
	});

	it('renders only the active chart\'s controls in the params pane', () => {
		renderChartControlsSidebar(shownFor('scatter'));
		expect(mocks.createScatterPlotControls).toHaveBeenCalledTimes(1);
		expect(mocks.setupScatterPlotControlListeners).toHaveBeenCalledTimes(1);
		expect(document.querySelector('#viz-select-bar')).toBeNull();
		expect(document.querySelector('#viz-select-line-x')).toBeNull();
	});

	it.each([
		['treemap', ['data', 'display', 'styling', 'advanced'], '#viz-select-treemap-category', true],
		['bar', ['data', 'display', 'styling', 'advanced'], '#viz-select-bar-sort', true],
		['pie', ['data', 'display', 'styling'], '#viz-btn-pie-reset-zoom', false],
		['bubble', ['data', 'display', 'styling'], '#viz-select-bubble-nesting-level-0', true],
		['line', ['data', 'styling', 'display'], '#viz-select-line-x', false],
		['network', ['data', 'display', 'styling', 'advanced'], '#viz-btn-network-reset-zoom', true],
		['scatter3d', ['data', 'display', 'styling'], '#viz-select-scatter3d-z', false],
		['tin', ['data', 'display', 'surface', 'overlays'], '#viz-input-tin-threshold-value', true],
	])('builds the %s controls from its descriptions', (chartType, sections, control, palette) => {
		renderChartControlsSidebar(shownFor(chartType));

		const params = document.getElementById('viz-chart-params');
		expect([...params.querySelectorAll('.chart-control-section')].map(section => section.dataset.section))
			.toEqual(sections);
		expect(params.querySelector(control)).not.toBeNull();
		expect(params.querySelector(`[data-color-preset-control="viz-${chartType}-color-preset"]`) !== null)
			.toBe(palette);
		expect(mocks.createScatterPlotControls).not.toHaveBeenCalled();
	});

	it('hands the pie controls the rows the chart draws, under the global filter', () => {
		const shown = deriveShownDataset({
			rows: [{ categoria: 'A', valor: 1 }, { categoria: 'B', valor: 2 }],
			columns: COLUMNS,
			selectedColumns: ['categoria', 'valor'],
			chartConfig: {
				...configWithActive('pie'),
				pie: { enabled: true, category: 'categoria', color: '#4e79a7', customSliceColors: {} },
				globalFilter: { rules: [{ column: 'categoria', mode: 'categorical', include: ['v:B'], exclude: [] }], combine: 'AND' },
			},
		});

		renderChartControlsSidebar(shown);

		// The slice grid lists every category and shows the color the chart draws
		// each with; the filter hides A, so only B is drawn.
		expect(shown.rows).toEqual([{ categoria: 'B', valor: 2 }]);
		const swatch = key => document.querySelector(`input[data-color-grid-control="viz-pie-color-grid"][data-color-item="${key}"]`).value;
		expect(swatch('A')).toBe('#999999');
		expect(swatch('B')).toBe('#4e79a7');
	});

	it('shows the params empty-state placeholder when no chart is active', () => {
		renderChartControlsSidebar(shownFor());
		const empty = document.querySelector('#viz-chart-params .viz-params-empty');
		expect(empty).not.toBeNull();
		expect(document.querySelector('#viz-chart-params .chart-control-section')).toBeNull();
		expect(mocks.createScatterPlotControls).not.toHaveBeenCalled();
	});

	it('shows global empty-state when no dataset is provided', () => {
		renderChartControlsSidebar(null);
		const empty = document.querySelector('#viz-chart-params .table-no-columns');
		expect(empty).not.toBeNull();
		expect(document.querySelector('.viz-chart-picker-trigger')).toBeNull();
	});

	it('shows global empty-state when every column is hidden', () => {
		renderChartControlsSidebar(shownFor('bar', { selectedColumns: [] }));

		const empty = document.querySelector('#viz-chart-params .table-no-columns');
		expect(empty).not.toBeNull();
		expect(empty?.textContent).toBe('chive-chart-sidebar-empty');
		expect(document.querySelector('#viz-chart-params .chart-control-section')).toBeNull();
	});

	it('clicking the trigger opens the picker with current activeChartType', () => {
		renderChartControlsSidebar(shownFor('bar'));
		document.querySelector('.viz-chart-picker-trigger').click();
		expect(mocks.openChartTypePickerDialog).toHaveBeenCalledTimes(1);
		expect(mocks.openChartTypePickerDialog).toHaveBeenCalledWith(
			expect.objectContaining({ activeChartType: 'bar' })
		);
	});

	it('picker resolving with a chartType activates that chart with defaults', async () => {
		mocks.openChartTypePickerDialog.mockReturnValueOnce(Promise.resolve({ chartType: 'scatter' }));
		renderChartControlsSidebar(shownFor('bar'));
		document.querySelector('.viz-chart-picker-trigger').click();
		await Promise.resolve();
		await Promise.resolve();
		expect(mocks.setActiveChartType).toHaveBeenCalledWith(
			'scatter',
			expect.objectContaining({ expanded: true })
		);
	});

	it('picker resolving with { chartType: null } deselects', async () => {
		mocks.openChartTypePickerDialog.mockReturnValueOnce(Promise.resolve({ chartType: null }));
		renderChartControlsSidebar(shownFor('bar'));
		document.querySelector('.viz-chart-picker-trigger').click();
		await Promise.resolve();
		await Promise.resolve();
		expect(mocks.setActiveChartType).toHaveBeenCalledWith(null);
	});

	it('picker resolving with null (cancel) does not change state', async () => {
		mocks.openChartTypePickerDialog.mockReturnValueOnce(Promise.resolve(null));
		renderChartControlsSidebar(shownFor('bar'));
		document.querySelector('.viz-chart-picker-trigger').click();
		await Promise.resolve();
		await Promise.resolve();
		expect(mocks.setActiveChartType).not.toHaveBeenCalled();
	});

	it('preserves expanded state of control sections across rerenders', () => {
		// The bar's styling section starts collapsed.
		renderChartControlsSidebar(shownFor('bar'));
		expect(document.querySelector('.chart-control-section[data-section="styling"] .chart-section-header').getAttribute('aria-expanded'))
			.toBe('false');

		const header = document.querySelector('.chart-control-section[data-section="styling"] .chart-section-header');
		const content = document.querySelector('.chart-control-section[data-section="styling"] .chart-section-content');
		const toggleIcon = document.querySelector('.chart-control-section[data-section="styling"] .chart-section-toggle');
		header.setAttribute('aria-expanded', 'true');
		content.hidden = false;
		toggleIcon.textContent = '▼';

		renderChartControlsSidebar(shownFor('bar'));

		const nextHeader = document.querySelector('.chart-control-section[data-section="styling"] .chart-section-header');
		const nextContent = document.querySelector('.chart-control-section[data-section="styling"] .chart-section-content');
		const nextToggle = document.querySelector('.chart-control-section[data-section="styling"] .chart-section-toggle');
		expect(nextHeader?.getAttribute('aria-expanded')).toBe('true');
		expect(nextContent?.hidden).toBe(false);
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

	it('pie: returns category + first-numeric valueColumn in sum mode', () => {
		const defaults = computeActivationDefaults('pie', makeDataset({ pie: { measureMode: 'sum', valueColumn: null } }), { numeric, categorical, allColumns });
		expect(defaults).toEqual({ category: 'c1', valueColumn: 'n1' });
	});

	it('pie: keeps the valueColumn in count mode', () => {
		const defaults = computeActivationDefaults('pie', makeDataset({ pie: { measureMode: 'count', valueColumn: null } }), { numeric, categorical, allColumns });
		expect(defaults).toEqual({ category: 'c1', valueColumn: null });
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

	const context = {
		numeric: ['valor'],
		categorical: ['categoria'],
		dates: [],
		allColumns: ['categoria', 'valor'],
		baseCategoricalOrAll: ['categoria'],
		rows: [],
	};

	it('calls setActiveChartType(null) when given null', () => {
		handleChartTypeSelect(null, { chartConfig: {} }, context);
		expect(mocks.setActiveChartType).toHaveBeenCalledWith(null);
	});

	it('forwards computed defaults + expanded:true when activating a chart', () => {
		handleChartTypeSelect('bar', { chartConfig: {} }, context);
		expect(mocks.setActiveChartType).toHaveBeenCalledWith(
			'bar',
			expect.objectContaining({ category: 'categoria', expanded: true })
		);
	});
});
