// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSliceColor } from '../../../src/charts/pie/color.js';
import { PIE_CONTROLS } from '../../../src/charts/pie/controls/descriptions.js';
import { buildDescribedControls } from '../../../src/charts/shared/controls/describedControls.js';
import { COLOR_PRESETS } from '../../../src/charts/shared/controls/factories.js';
import { MISSING_KEY } from '../../../src/domain/datasets/cellValues.js';
import { filterDataset } from '../../../src/domain/filters/datasetFilter.js';
import { PIE_DEFINITION } from '../../../src/config/charts/definitions/pie.js';

/**
 * Writer test double. The controls' contract is that they hand the right
 * patch to the writer; merging it into state, firing onConfigChanged, and
 * live-rendering are the adapter's contract and are covered by
 * tests/features/datasetWorkspace/chartControls/chartConfigAdapter.test.js.
 */
function createWriter() {
	return { commit: vi.fn(), preview: vi.fn() };
}

describe('pie controls module boundaries', () => {
	it('declares its controls as descriptions, with the hand-written ones beside them', async () => {
		const [descriptions, custom] = await Promise.all([
			import('../../../src/charts/pie/controls/descriptions.js'),
			import('../../../src/charts/pie/controls/customControls.js'),
		]);
		expect(Object.keys(descriptions)).toEqual(['PIE_CONTROLS']);
		expect(Object.keys(custom).sort()).toEqual([
			'buildRadiusSliders',
			'buildSliceColorGrid',
			'buildSlicePalette',
		]);
		expect(PIE_CONTROLS.definition).toBe(PIE_DEFINITION);
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
		columns: [
			{ name: 'region', type: 'text' },
			{ name: 'sales', type: 'number' },
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

/** The sidebar's context: the drawn rows default to every dataset row. */
function createContext(dataset, { categories = ['region'], numeric = ['sales'], rows = dataset.rows } = {}) {
	return {
		baseCategoricalOrAll: categories,
		categorical: categories,
		numeric,
		allColumns: [...categories, ...numeric],
		dates: [],
		rows,
	};
}

function buildControls(dataset, writer = createWriter(), context = createContext(dataset)) {
	return buildDescribedControls(PIE_CONTROLS, { dataset, context, writer, translate: key => key });
}

/** Build the controls into the document, as the sidebar does after each commit. */
function mountControls(dataset, writer = createWriter(), context = createContext(dataset)) {
	document.body.replaceChildren(...buildControls(dataset, writer, context));
	return writer;
}

function selectValue(id, value) {
	const select = document.getElementById(id);
	if (![...select.options].some(option => option.value === value)) {
		select.append(new Option(value, value));
	}
	select.value = value;
	select.dispatchEvent(new Event('change', { bubbles: true }));
}

function lastConfig(writer) {
	return writer.commit.mock.calls.at(-1)[0];
}

function applyLastCommit(dataset, writer) {
	Object.assign(dataset.chartConfig.pie, lastConfig(writer));
}

function presetButton(name) {
	return document.querySelector(`button[data-color-preset-control="viz-pie-color-preset"][data-preset-name="${name}"]`);
}

function markedPresets() {
	return [...document.querySelectorAll('button[data-color-preset-control="viz-pie-color-preset"]')]
		.filter(button => button.style.border.startsWith('2px'))
		.map(button => button.dataset.presetName);
}

function swatch(key) {
	return document.querySelector(`input[data-color-grid-control="viz-pie-color-grid"][data-color-item="${key}"]`);
}

function sliceInputs() {
	return [...document.querySelectorAll('input[data-color-grid-control="viz-pie-color-grid"]')];
}

describe('pieControls UI structure', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	// Locks the per-section grouping and control ordering. The behavioral tests
	// assert individual ids/states; this pins the whole structure (section id,
	// expansion, ordered control keys) so a future move cannot silently reorder
	// or regroup controls.
	it('matches the section and control-order structure snapshot', () => {
		const dataset = createDataset();
		const controls = buildControls(dataset, createWriter(), createContext(dataset, { categories: ['region', 'team'] }));

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
		mountControls(dataset, createWriter(), createContext(dataset, { categories: ['region', 'team'] }));

		const values = Array.from(document.getElementById('viz-select-pie-category').options).map(o => o.value);
		expect(values).toEqual(['', 'region', 'team']);
	});

	it('offers the measures, Top-N modes and label positions the pie definition lists', () => {
		mountControls(createDataset());

		const values = id => Array.from(document.getElementById(id).options, option => option.value);
		expect(values('viz-select-pie-measure')).toEqual(PIE_DEFINITION.allowedValues.measureMode);
		expect(values('viz-select-pie-topn-mode')).toEqual(PIE_DEFINITION.allowedValues.topNMode);
		expect(values('viz-select-pie-label-position')).toEqual(PIE_DEFINITION.allowedValues.labelPosition);
	});

	it('renders one per-slice color input per distinct sector value', () => {
		mountControls(createDataset());

		expect(sliceInputs().map(input => input.dataset.colorItem).sort()).toEqual(['East', 'North', 'South']);
	});

	it('keeps a slice the global filter hides in the grid with the neutral swatch', () => {
		const dataset = createDataset();
		dataset.chartConfig.globalFilter = {
			rules: [{ column: 'region', mode: 'categorical', include: [], exclude: ['v:North'] }],
			combine: 'AND',
		};
		// The sidebar's context holds the rows the chart draws.
		mountControls(dataset, createWriter(), createContext(dataset, { rows: filterDataset(dataset).rows }));

		expect(swatch('North').value).toBe('#999999');
		// East now leads the drawn chart, so it takes the base color.
		expect(swatch('East').value).toBe('#4e79a7');
	});

	it('omits sector color controls when there is no usable category data', () => {
		mountControls(createDataset({ category: null }));

		expect(presetButton('Bold')).toBeNull();
		expect(sliceInputs()).toEqual([]);

		const noRowsDataset = createDataset();
		noRowsDataset.rows = null;
		mountControls(noRowsDataset, createWriter(), createContext(noRowsDataset, { rows: null }));
		expect(presetButton('Bold')).toBeNull();
		expect(sliceInputs()).toEqual([]);
	});

	it('orders sum-mode sectors, buckets missing categories, and skips invalid numbers', () => {
		const dataset = createDataset({ measureMode: 'sum', valueColumn: 'sales' });
		dataset.rows = [
			{ region: 'North', sales: 10 },
			{ region: null, sales: 7 },
			{ region: null, sales: 5 },
			{ region: 'South', sales: null },
			{ region: 'East', sales: 9 },
		];

		mountControls(dataset);

		const inputs = sliceInputs();
		expect(inputs.map(input => input.dataset.colorItem)).toEqual([MISSING_KEY, 'North', 'East']);
		expect(inputs[0].nextElementSibling.textContent).toBe('chive-chart-filter-missing'.slice(0, 12));
	});

	it('renders disabled controls and fallback selections for invalid options', () => {
		mountControls(createDataset({
			enabled: false,
			topN: 'bad',
			topNMode: 'truncate',
			labelPosition: 'inside',
			customSliceColors: null,
		}));

		expect(document.getElementById('viz-select-pie-topn').value).toBe('0');
		expect(document.getElementById('viz-select-pie-topn-mode').value).toBe('truncate');
		expect(document.getElementById('viz-select-pie-category').disabled).toBe(true);
		expect(document.getElementById('viz-slider-pie-inner-radius').disabled).toBe(true);
		expect(document.getElementById('viz-btn-pie-reset-zoom').disabled).toBe(true);
		expect(presetButton('Bold').disabled).toBe(true);
		expect(sliceInputs()[0].disabled).toBe(true);
	});

	it('shows the limit the chart reads from a limit stored as text', () => {
		mountControls(createDataset({ topN: ' 20 ' }));

		expect(document.getElementById('viz-select-pie-topn').value).toBe('20');
	});
});

describe('pieControls writes', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('commits a measureMode change and switches valueColumn defaults', () => {
		const writer = mountControls(createDataset({ measureMode: 'count', valueColumn: null }));

		selectValue('viz-select-pie-measure', 'sum');

		expect(writer.commit).toHaveBeenCalledWith({ measureMode: 'sum', valueColumn: 'sales' });
		expect(writer.commit).toHaveBeenCalledTimes(1);
	});

	it('applies a color preset palette to the per-slice color map, keeping the colors of other categories', () => {
		const dataset = createDataset({ customSliceColors: { West: '#010203' } });
		const writer = mountControls(dataset);

		presetButton('Bold').click();

		expect(writer.commit).toHaveBeenCalledTimes(1);
		expect(lastConfig(writer)).toEqual({
			colorScheme: 'Bold',
			customSliceColors: {
				West: '#010203',
				// Count order, ties by name: North (2 rows), East, South.
				North: COLOR_PRESETS.Bold[0],
				East: COLOR_PRESETS.Bold[1],
				South: COLOR_PRESETS.Bold[2],
			},
		});
	});

	it('reads the slice colors of the moment a palette is applied', () => {
		const dataset = createDataset();
		const writer = mountControls(dataset);

		dataset.chartConfig = { pie: { ...dataset.chartConfig.pie, customSliceColors: { West: '#0a0b0c' } } };
		presetButton('Pastel').click();

		expect(lastConfig(writer).customSliceColors.West).toBe('#0a0b0c');
	});

	it('repeats the palette over more sectors than it has colors', () => {
		const dataset = createDataset();
		// Ten categories, one row each, so they sort by name.
		dataset.rows = Array.from({ length: 10 }, (_, index) => ({ region: `r${index}`, sales: 1 }));
		const writer = mountControls(dataset);

		presetButton('Pastel').click();

		const colors = lastConfig(writer).customSliceColors;
		expect(COLOR_PRESETS.Pastel).toHaveLength(8);
		expect([colors.r8, colors.r9]).toEqual([COLOR_PRESETS.Pastel[0], COLOR_PRESETS.Pastel[1]]);
	});

	it('reads the slice colors of the moment a picker closes', () => {
		const dataset = createDataset();
		const writer = mountControls(dataset);

		dataset.chartConfig = { pie: { ...dataset.chartConfig.pie, customSliceColors: { West: '#0a0b0c' } } };
		swatch('North').value = '#123456';
		swatch('North').dispatchEvent(new Event('change', { bubbles: true }));

		expect(lastConfig(writer)).toEqual({ customSliceColors: { West: '#0a0b0c', North: '#123456' } });
	});

	// Per-slice color writes must never mutate dataset.chartConfig directly. On
	// `input` the write goes through writer.preview (the non-emitting path: no
	// DATASET_CONFIG_UPDATED, no sidebar rebuild, so the open picker keeps focus); on
	// `change` writer.commit takes the final value. If a bypass assigned to
	// dataset.chartConfig.pie.customSliceColors, neither writer method would be
	// called and this test would fail. chartConfigAdapter.test.js owns which
	// facade each method reaches.
	it('routes input writes through preview and commits the final value on change', () => {
		const writer = mountControls(createDataset());
		const sliceInput = swatch('North');

		sliceInput.value = '#ff0000';
		sliceInput.dispatchEvent(new Event('input', { bubbles: true }));

		// No commit on input: emitting there would rebuild the sidebar mid-drag.
		expect(writer.commit).not.toHaveBeenCalled();

		// Preview got a patch function; applying it sets customSliceColors[North]
		// without dropping the sibling slice colors already in the config.
		expect(writer.preview).toHaveBeenCalledTimes(1);
		const patchFn = writer.preview.mock.calls[0][0];
		const patch = patchFn({ customSliceColors: { South: '#00ff00' } });
		expect(patch.customSliceColors).toEqual({ South: '#00ff00', North: '#ff0000' });

		sliceInput.dispatchEvent(new Event('change', { bubbles: true }));

		expect(writer.commit).toHaveBeenCalledTimes(1);
		expect(lastConfig(writer)).toEqual({ customSliceColors: { North: '#ff0000' } });
	});

	it('ignores color-grid events with no sector token', () => {
		const writer = mountControls(createDataset());
		const [sliceInput] = sliceInputs();

		delete sliceInput.dataset.colorItem;
		sliceInput.dispatchEvent(new Event('input', { bubbles: true }));
		sliceInput.dispatchEvent(new Event('change', { bubbles: true }));

		expect(writer.preview).not.toHaveBeenCalled();
		expect(writer.commit).not.toHaveBeenCalled();
	});

	it('commits selected enums as chosen and coerces the numeric select', () => {
		const dataset = createDataset();
		const writer = mountControls(dataset, createWriter(), createContext(dataset, { categories: ['region', 'team'] }));

		selectValue('viz-select-pie-category', 'team');
		expect(lastConfig(writer)).toEqual({ category: 'team' });

		selectValue('viz-select-pie-value-column', '');
		expect(lastConfig(writer)).toEqual({ valueColumn: null });

		selectValue('viz-select-pie-label-position', 'sideways');
		// The commit canonicalizes forged enumerated values.
		expect(lastConfig(writer)).toEqual({ labelPosition: 'sideways' });

		selectValue('viz-select-pie-topn', '20');
		expect(lastConfig(writer)).toEqual({ topN: 20 });

		selectValue('viz-select-pie-topn-mode', 'unknown');
		expect(lastConfig(writer)).toEqual({ topNMode: 'unknown' });

		expect(writer.commit).toHaveBeenCalledTimes(5);
	});

	it('keeps or clears the value column when measure mode changes', () => {
		const dataset = createDataset({ measureMode: 'sum', valueColumn: 'sales' });
		const writer = mountControls(dataset, createWriter(), createContext(dataset, { numeric: ['sales', 'profit'] }));

		selectValue('viz-select-pie-measure', 'count');
		expect(lastConfig(writer)).toEqual({ measureMode: 'count', valueColumn: 'sales' });

		dataset.chartConfig.pie.valueColumn = 'profit';
		selectValue('viz-select-pie-measure', 'sum');
		expect(lastConfig(writer)).toEqual({ measureMode: 'sum', valueColumn: 'profit' });

		dataset.chartConfig.pie.valueColumn = 'old';
		selectValue('viz-select-pie-measure', 'sum');
		expect(lastConfig(writer)).toEqual({ measureMode: 'sum', valueColumn: 'sales' });

		const noNumericDataset = createDataset({ measureMode: 'count', valueColumn: 'old' });
		mountControls(noNumericDataset, writer, createContext(noNumericDataset, { numeric: [] }));
		selectValue('viz-select-pie-measure', 'sum');
		expect(lastConfig(writer)).toEqual({ measureMode: 'sum', valueColumn: null });
	});

	it('clamps inner and outer radius changes and updates visible slider output', () => {
		const writer = mountControls(createDataset({ innerRadius: 40, outerRadius: 50 }));
		const inner = document.getElementById('viz-slider-pie-inner-radius');
		const outer = document.getElementById('viz-slider-pie-outer-radius');

		outer.value = '45';
		inner.value = '60';
		inner.dispatchEvent(new Event('input', { bubbles: true }));
		expect(inner.parentElement.querySelector('output').textContent).toBe('60');
		inner.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual({ innerRadius: 37 });
		expect(inner.value).toBe('37');
		expect(inner.parentElement.querySelector('output').textContent).toBe('37');

		inner.value = '40';
		outer.value = '30';
		outer.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual({ outerRadius: 30, innerRadius: 22 });
		expect(inner.value).toBe('22');
	});

	it('commits pad angle and zoom as numbers when a slider is released', () => {
		const writer = mountControls(createDataset());

		const padAngle = document.getElementById('viz-slider-pie-pad-angle');
		padAngle.value = '2.5';
		padAngle.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual({ padAngle: 2.5 });

		const zoom = document.getElementById('viz-slider-pie-zoom');
		zoom.value = '1.5';
		zoom.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual({ zoomScale: 1.5 });
	});

	it('resets the zoom and moves the zoom slider back', () => {
		const writer = mountControls(createDataset({ zoomScale: 2 }));
		const zoom = document.getElementById('viz-slider-pie-zoom');

		zoom.value = '3';
		document.getElementById('viz-btn-pie-reset-zoom').click();

		expect(lastConfig(writer)).toEqual({ zoomScale: 1 });
		expect(zoom.value).toBe('1');
		expect(zoom.parentElement.querySelector('output').textContent).toBe('1');
	});

	it('commits the label and legend toggles, the title trimmed, and the base color', () => {
		const writer = mountControls(createDataset());

		document.getElementById('viz-toggle-pie-category-label').click();
		expect(lastConfig(writer)).toEqual({ showCategoryLabel: false });
		document.getElementById('viz-toggle-pie-value-label').click();
		expect(lastConfig(writer)).toEqual({ showValueLabel: true });
		document.getElementById('viz-toggle-pie-legend').click();
		expect(lastConfig(writer)).toEqual({ showLegend: false });

		const title = document.getElementById('viz-input-pie-title');
		title.value = '  Share  ';
		title.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual({ customTitle: 'Share' });

		const color = document.getElementById('viz-input-pie-color');
		color.value = '#123456';
		color.dispatchEvent(new Event('input', { bubbles: true }));
		expect(writer.preview).toHaveBeenLastCalledWith({ color: '#123456' });
		color.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual({ color: '#123456' });
	});
});

describe('pieControls color palette mark', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('marks no palette while the sectors keep their default shades', () => {
		const { colorScheme, customSliceColors } = PIE_DEFINITION.createDefaultConfig();
		mountControls(createDataset({ colorScheme, customSliceColors }));

		expect(markedPresets()).toEqual([]);
	});

	it('marks a palette once its button colors the sectors, until one sector color is edited', () => {
		const dataset = createDataset();
		const writer = createWriter();
		mountControls(dataset, writer);

		presetButton('Pastel').click();
		applyLastCommit(dataset, writer);
		mountControls(dataset, writer);
		expect(markedPresets()).toEqual(['Pastel']);

		swatch('South').value = '#123456';
		swatch('South').dispatchEvent(new Event('change'));
		applyLastCommit(dataset, writer);
		mountControls(dataset, writer);
		expect(markedPresets()).toEqual([]);
	});
});

describe('pieControls with categories named like Object.prototype members', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	// Category keys are cell text, and the slice colors are keyed by them.
	function prototypeNamesDataset() {
		const dataset = createDataset();
		dataset.rows = ['constructor', 'constructor', 'constructor', 'toString', 'toString', '__proto__']
			.map(region => ({ region, sales: 1 }));
		return dataset;
	}

	it('shows the shades the chart draws them with in the grid', () => {
		mountControls(prototypeNamesDataset());

		expect(['constructor', 'toString', '__proto__'].map(key => swatch(key).value)).toEqual([
			'#4e79a7',
			buildSliceColor('#4e79a7', 1),
			buildSliceColor('#4e79a7', 2),
		]);
	});

	it('keeps the palette color and a picked color of a category named __proto__', () => {
		const dataset = prototypeNamesDataset();
		const writer = createWriter();
		mountControls(dataset, writer);

		presetButton('Pastel').click();
		applyLastCommit(dataset, writer);
		mountControls(dataset, writer);
		expect(markedPresets()).toEqual(['Pastel']);

		swatch('__proto__').value = '#123456';
		swatch('__proto__').dispatchEvent(new Event('change'));
		applyLastCommit(dataset, writer);
		mountControls(dataset, writer);
		expect(swatch('__proto__').value).toBe('#123456');
		expect(markedPresets()).toEqual([]);
	});
});
