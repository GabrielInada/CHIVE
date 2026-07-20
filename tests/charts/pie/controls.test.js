// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	t: vi.fn(key => key),
}));

vi.mock('../../../src/services/i18nService.js', () => ({
	t: mocks.t,
}));

import { createPieChartControls } from '../../../src/charts/pie/controls/builder.js';
import { setupPieChartControlListeners } from '../../../src/charts/pie/controls/listeners.js';
import { computeDefaults } from '../../../src/charts/pie/controls/activationDefaults.js';

/**
 * Writer test double. The listeners' contract is that they hand the right
 * patch to the writer; merging it into state, firing onConfigChanged, and
 * live-rendering are the adapter's contract and are covered by
 * tests/features/datasetWorkspace/chartControls/chartConfigAdapter.test.js.
 */
function createWriter() {
	return { commit: vi.fn(), preview: vi.fn() };
}

describe('pie controls module boundaries', () => {
	it('keeps builder, listener, and defaults exports in dedicated modules', async () => {
		const [builder, listeners, defaults] = await Promise.all([
			import('../../../src/charts/pie/controls/builder.js'),
			import('../../../src/charts/pie/controls/listeners.js'),
			import('../../../src/charts/pie/controls/activationDefaults.js'),
		]);
		expect(Object.keys(builder)).toEqual(['createPieChartControls']);
		expect(Object.keys(listeners)).toEqual(['setupPieChartControlListeners']);
		expect(Object.keys(defaults)).toEqual(['computeDefaults']);
	});
});

function createDataset(overrides = {}) {
	return {
		rows: [
			{ region: 'North', sales: 10 },
			{ region: 'North', sales: 15 },
			{ region: 'South', sales: 20 },
			{ region: 'East', sales: 5 },
		],
		chartConfig: {
			pie: {
				enabled: true,
				expanded: true,
				category: 'region',
				valueColumn: 'sales',
				measureMode: 'count',
				topN: 0,
				topNMode: 'other',
				innerRadius: 0,
				outerRadius: 180,
				padAngle: 0,
				zoomScale: 1,
				showCategoryLabel: true,
				showValueLabel: false,
				showLegend: true,
				customTitle: '',
				chartHeight: 360,
				labelPosition: 'outside',
				color: '#4e79a7',
				colorScheme: 'Bold',
				customSliceColors: {},
				...overrides,
			},
		},
	};
}

function appendControls(controls) {
	controls.forEach(control => document.body.appendChild(control));
}

function selectValue(id, value) {
	const select = document.getElementById(id);
	if (![...select.options].some(option => option.value === value)) {
		const option = document.createElement('option');
		option.value = value;
		select.appendChild(option);
	}
	select.value = value;
	select.dispatchEvent(new Event('change', { bubbles: true }));
}

function lastConfig(writer) {
	return writer.commit.mock.calls.at(-1)[0];
}

describe('pieControls UI structure', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	// Locks the per-section grouping and control ordering across the split into
	// the package's controls/ folder. The behavioral tests assert individual ids/states;
	// this pins the whole structure (section id, expansion, ordered control keys)
	// so a future move cannot silently reorder or regroup controls.
	it('matches the section and control-order structure snapshot', () => {
		const dataset = createDataset();
		const controls = createPieChartControls(dataset, ['region', 'team'], ['sales'], ['region', 'team', 'sales']);

		const structure = controls.map(section => {
			const content = section.querySelector('.chart-section-content');
			const controlKeys = Array.from(content.children).map(control => {
				const idElement = control.matches('[id]') ? control : control.querySelector('[id]');
				if (idElement?.id) return idElement.id;
				return control.querySelector('[data-color-preset-control]')?.dataset.colorPresetControl;
			});
			expect(controlKeys).not.toContain(undefined);

			return {
				section: section.dataset.section,
				expanded: section.querySelector('.chart-section-header').getAttribute('aria-expanded'),
				controlKeys,
			};
		});

		expect(structure).toMatchSnapshot();
	});

	it('offers categorical columns plus an empty (none) option in the category select', () => {
		const dataset = createDataset();
		const controls = createPieChartControls(dataset, ['region', 'team'], ['sales'], ['region', 'team', 'sales']);
		appendControls(controls);

		const values = Array.from(document.getElementById('viz-select-pie-category').options).map(o => o.value);
		expect(values).toEqual(['', 'region', 'team']);
	});

	it('disables the value-column select when measureMode is count', () => {
		const countDataset = createDataset({ measureMode: 'count' });
		const countControls = createPieChartControls(countDataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(countControls);
		expect(document.getElementById('viz-select-pie-value-column').disabled).toBe(true);

		document.body.innerHTML = '';
		const sumDataset = createDataset({ measureMode: 'sum' });
		const sumControls = createPieChartControls(sumDataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(sumControls);
		expect(document.getElementById('viz-select-pie-value-column').disabled).toBe(false);
	});

	it('renders one per-slice color input per distinct sector value', () => {
		const dataset = createDataset();
		const controls = createPieChartControls(dataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(controls);

		const sliceInputs = document.querySelectorAll('input[data-color-grid-control="viz-pie-color-grid"]');
		expect(sliceInputs.length).toBe(3); // North, South, East
		const tokens = Array.from(sliceInputs).map(input => input.dataset.colorItem).sort();
		expect(tokens).toEqual(['East', 'North', 'South']);
	});

	it('omits sector color controls when there is no usable category data', () => {
		const dataset = createDataset({ category: null });
		const controls = createPieChartControls(dataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(controls);

		expect(document.querySelector('button[data-color-preset-control="viz-pie-color-preset"]')).toBeNull();
		expect(document.querySelector('input[data-color-grid-control="viz-pie-color-grid"]')).toBeNull();

		document.body.innerHTML = '';
		const noRowsDataset = createDataset();
		noRowsDataset.rows = null;
		appendControls(createPieChartControls(noRowsDataset, ['region'], ['sales'], ['region', 'sales']));
		expect(document.querySelector('input[data-color-grid-control="viz-pie-color-grid"]')).toBeNull();
	});

	it('orders sum-mode sectors, buckets missing categories, and skips invalid numbers', () => {
		const dataset = createDataset({ measureMode: 'sum', valueColumn: 'sales' });
		dataset.rows = [
			{ region: 'North', sales: 10 },
			{ region: '', sales: 7 },
			{ region: null, sales: 5 },
			{ region: 'South', sales: 'bad' },
			{ region: 'East', sales: 9 },
		];

		appendControls(createPieChartControls(dataset, ['region'], ['sales'], ['region', 'sales']));

		const tokens = Array.from(document.querySelectorAll('input[data-color-grid-control="viz-pie-color-grid"]'))
			.map(input => input.dataset.colorItem);
		expect(tokens).toEqual(['N/A', 'North', 'East']);
	});

	it('renders disabled controls and fallback selections for invalid options', () => {
		const dataset = createDataset({
			enabled: false,
			topN: 'bad',
			topNMode: 'truncate',
			labelPosition: 'inside',
			customSliceColors: null,
		});
		const controls = createPieChartControls(dataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(controls);

		expect(document.getElementById('viz-select-pie-topn').value).toBe('0');
		expect(document.getElementById('viz-select-pie-topn-mode').value).toBe('truncate');
		expect(document.getElementById('viz-select-pie-category').disabled).toBe(true);
		expect(document.querySelector('input[data-color-grid-control="viz-pie-color-grid"]').disabled).toBe(true);
	});
});

describe('pieControls listeners', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	it('commits a measureMode change through the facade and switches valueColumn defaults', () => {
		const dataset = createDataset({ measureMode: 'count', valueColumn: null });
		const controls = createPieChartControls(dataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(controls);

		const writer = createWriter();
		setupPieChartControlListeners(dataset, dataset.chartConfig.pie, ['sales'], ['region', 'sales'], writer);

		const measureSelect = document.getElementById('viz-select-pie-measure');
		measureSelect.value = 'sum';
		measureSelect.dispatchEvent(new Event('change', { bubbles: true }));

		expect(writer.commit).toHaveBeenCalledWith(expect.objectContaining({ measureMode: 'sum', valueColumn: 'sales' }));
		expect(writer.commit).toHaveBeenCalledTimes(1);
	});

	it('applies a color preset palette to the per-slice color map', () => {
		const dataset = createDataset();
		const controls = createPieChartControls(dataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(controls);

		const writer = createWriter();
		setupPieChartControlListeners(dataset, dataset.chartConfig.pie, ['sales'], ['region', 'sales'], writer);

		const boldButton = document.querySelector('button[data-color-preset-control="viz-pie-color-preset"][data-preset-name="Bold"]');
		expect(boldButton).not.toBeNull();
		boldButton.click();

		expect(writer.commit).toHaveBeenCalledTimes(1);
		const call = writer.commit.mock.calls[0][0];
		expect(call.colorScheme).toBe('Bold');
		// One mapped color per distinct sector
		expect(Object.keys(call.customSliceColors).sort()).toEqual(['East', 'North', 'South']);
	});

	// Regression guard for the P0 fix and the wider color-helper fix:
	// per-slice color writes must NEVER mutate dataset.chartConfig directly.
	// On `input` the write goes through writer.preview (the non-emitting path:
	// no CONFIG_UPDATED, no sidebar rebuild, so the open picker keeps focus);
	// on `change` writer.commit takes the final value. If anyone re-introduces a
	// bypass listener (direct assignment to
	// dataset.chartConfig.pie.customSliceColors), neither writer method is
	// called and this test fails. That preview/commit split is enforced in
	// chartConfigAdapter.test.js, which owns which facade each one reaches.
	it('routes input writes through preview and commits the final value on change', () => {
		const dataset = createDataset();
		const controls = createPieChartControls(dataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(controls);

		const writer = createWriter();
		setupPieChartControlListeners(dataset, dataset.chartConfig.pie, ['sales'], ['region', 'sales'], writer);

		const sliceInput = document.querySelector('input[data-color-grid-control="viz-pie-color-grid"][data-color-item="North"]');
		expect(sliceInput).not.toBeNull();

		sliceInput.value = '#ff0000';
		sliceInput.dispatchEvent(new Event('input', { bubbles: true }));

		// No commit on input: emitting there would rebuild the sidebar mid-drag.
		expect(writer.commit).not.toHaveBeenCalled();

		// Preview got a patch function; applying it sets customSliceColors[North]
		// without dropping the sibling slice colors already in the config.
		expect(writer.preview).toHaveBeenCalledTimes(1);
		const patchFn = writer.preview.mock.calls[0][0];
		const patch = patchFn({ customSliceColors: { South: '#00ff00' } });
		expect(patch.customSliceColors.North).toBe('#ff0000');
		expect(patch.customSliceColors.South).toBe('#00ff00');

		sliceInput.dispatchEvent(new Event('change', { bubbles: true }));

		expect(writer.commit).toHaveBeenCalledTimes(1);
		const call = writer.commit.mock.calls[0][0];
		expect(call.customSliceColors.North).toBe('#ff0000');
	});

	it('handles missing DOM controls as no-ops', () => {
		const dataset = createDataset();

		const writer = createWriter();
		expect(() => setupPieChartControlListeners(dataset, dataset.chartConfig.pie, ['sales'], [], writer)).not.toThrow();
		expect(writer.commit).not.toHaveBeenCalled();
	});

	it('coerces select values and supports the legacy callback argument position', () => {
		const dataset = createDataset();
		const controls = createPieChartControls(dataset, ['region', 'team'], ['sales'], ['region', 'team', 'sales']);
		appendControls(controls);

		const writer = createWriter();
		setupPieChartControlListeners(dataset, dataset.chartConfig.pie, ['sales'], [], writer);

		selectValue('viz-select-pie-category', 'team');
		expect(lastConfig(writer).category).toBe('team');

		selectValue('viz-select-pie-value-column', '');
		expect(lastConfig(writer).valueColumn).toBeNull();

		selectValue('viz-select-pie-label-position', 'sideways');
		expect(lastConfig(writer).labelPosition).toBe('inside');

		selectValue('viz-select-pie-topn', '20');
		expect(lastConfig(writer).topN).toBe(20);

		selectValue('viz-select-pie-topn-mode', 'unknown');
		expect(lastConfig(writer).topNMode).toBe('other');

		expect(writer.commit).toHaveBeenCalledTimes(5);
	});

	it('keeps or clears the value column when measure mode changes', () => {
		const dataset = createDataset({ measureMode: 'sum', valueColumn: 'sales' });
		const controls = createPieChartControls(dataset, ['region'], ['sales', 'profit'], ['region', 'sales', 'profit']);
		appendControls(controls);

		const writer = createWriter();
		setupPieChartControlListeners(dataset, dataset.chartConfig.pie, ['sales', 'profit'], ['region', 'sales', 'profit'], writer);

		selectValue('viz-select-pie-measure', 'count');
		expect(lastConfig(writer)).toEqual(expect.objectContaining({ measureMode: 'count', valueColumn: 'sales' }));

		dataset.chartConfig.pie.valueColumn = 'profit';
		selectValue('viz-select-pie-measure', 'sum');
		expect(lastConfig(writer)).toEqual(expect.objectContaining({ measureMode: 'sum', valueColumn: 'profit' }));

		dataset.chartConfig.pie.valueColumn = 'old';
		selectValue('viz-select-pie-measure', 'sum');
		expect(lastConfig(writer)).toEqual(expect.objectContaining({ measureMode: 'sum', valueColumn: 'sales' }));

		document.body.innerHTML = '';
		const noNumericDataset = createDataset({ measureMode: 'count', valueColumn: 'old' });
		appendControls(createPieChartControls(noNumericDataset, ['region'], [], ['region']));
		setupPieChartControlListeners(noNumericDataset, noNumericDataset.chartConfig.pie, [], ['region'], writer);
		selectValue('viz-select-pie-measure', 'sum');
		expect(lastConfig(writer)).toEqual(expect.objectContaining({ measureMode: 'sum', valueColumn: null }));
	});

	it('clamps inner and outer radius changes and updates visible slider output', () => {
		const dataset = createDataset({ innerRadius: 40, outerRadius: 50 });
		const controls = createPieChartControls(dataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(controls);

		const writer = createWriter();
		setupPieChartControlListeners(dataset, dataset.chartConfig.pie, ['sales'], ['region', 'sales'], writer);

		const inner = document.getElementById('viz-slider-pie-inner-radius');
		const outer = document.getElementById('viz-slider-pie-outer-radius');

		outer.value = '45';
		inner.value = '60';
		inner.dispatchEvent(new Event('input', { bubbles: true }));
		expect(inner.parentElement.querySelector('output').textContent).toBe('60');
		inner.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer).innerRadius).toBe(37);
		expect(inner.value).toBe('37');
		expect(inner.parentElement.querySelector('output').textContent).toBe('37');

		inner.value = '40';
		outer.value = '30';
		outer.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual(expect.objectContaining({ outerRadius: 30, innerRadius: 22 }));
		expect(inner.value).toBe('22');
	});

	it('resets zoom with and without the zoom slider present', () => {
		const dataset = createDataset({ zoomScale: 2 });
		const controls = createPieChartControls(dataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(controls);

		const writer = createWriter();
		setupPieChartControlListeners(dataset, dataset.chartConfig.pie, ['sales'], ['region', 'sales'], writer);

		const zoom = document.getElementById('viz-slider-pie-zoom');
		zoom.value = '3';
		document.getElementById('viz-btn-pie-reset-zoom').click();
		expect(lastConfig(writer).zoomScale).toBe(1);
		expect(zoom.value).toBe('1');
		expect(zoom.parentElement.querySelector('output').textContent).toBe('1');

		document.body.innerHTML = '<button id="viz-btn-pie-reset-zoom" type="button"></button>';
		setupPieChartControlListeners(dataset, dataset.chartConfig.pie, ['sales'], ['region', 'sales'], writer);
		document.getElementById('viz-btn-pie-reset-zoom').click();
		expect(lastConfig(writer).zoomScale).toBe(1);
	});

	it('ignores unknown presets and color-grid events with no sector token', () => {
		const dataset = createDataset();
		const controls = createPieChartControls(dataset, ['region'], ['sales'], ['region', 'sales']);
		appendControls(controls);
		const unknownPreset = document.createElement('button');
		unknownPreset.dataset.colorPresetControl = 'viz-pie-color-preset';
		unknownPreset.dataset.presetName = 'Missing';
		document.body.appendChild(unknownPreset);

		const writer = createWriter();
		setupPieChartControlListeners(dataset, dataset.chartConfig.pie, ['sales'], ['region', 'sales'], writer);

		unknownPreset.click();
		expect(writer.commit).not.toHaveBeenCalled();

		const sliceInput = document.querySelector('input[data-color-grid-control="viz-pie-color-grid"]');
		delete sliceInput.dataset.colorItem;
		sliceInput.dispatchEvent(new Event('input', { bubbles: true }));
		sliceInput.dispatchEvent(new Event('change', { bubbles: true }));

		expect(writer.preview).not.toHaveBeenCalled();
		expect(writer.commit).not.toHaveBeenCalled();
	});
});

describe('pieControls computeDefaults', () => {
	it('preserves the current category and valueColumn when they are still in scope', () => {
		const dataset = createDataset({ category: 'region', valueColumn: 'sales' });
		const ctx = { baseCategoricalOrAll: ['region', 'team'], numeric: ['sales', 'profit'] };
		expect(computeDefaults(dataset, ctx)).toEqual({ category: 'region', valueColumn: 'sales' });
	});

	it('falls back to the first option when the current value is out of scope', () => {
		const dataset = createDataset({ category: 'old', valueColumn: 'gone' });
		const ctx = { baseCategoricalOrAll: ['region', 'team'], numeric: ['sales'] };
		expect(computeDefaults(dataset, ctx)).toEqual({ category: 'region', valueColumn: 'sales' });
	});

	it('returns null when there are no candidate columns', () => {
		const dataset = createDataset();
		const ctx = { baseCategoricalOrAll: [], numeric: [] };
		expect(computeDefaults(dataset, ctx)).toEqual({ category: null, valueColumn: null });
	});
});
