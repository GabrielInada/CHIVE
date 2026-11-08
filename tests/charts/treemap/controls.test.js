// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDescribedControls } from '../../../src/charts/shared/controls/describedControls.js';
import { TREEMAP_CONTROLS } from '../../../src/charts/treemap/controls/descriptions.js';
import { TREEMAP_DEFINITION } from '../../../src/config/charts/definitions/treemap.js';

/**
 * Writer test double. The controls' contract is that they hand the right
 * patch to the writer; merging it into state, firing onConfigChanged, and
 * live-rendering are the adapter's contract and are covered by
 * tests/features/datasetWorkspace/chartControls/chartConfigAdapter.test.js.
 */
function createWriter() {
	return { commit: vi.fn(), preview: vi.fn() };
}

function createDataset(overrides = {}) {
	return {
		chartConfig: {
			treemap: {
				enabled: true,
				expanded: true,
				category: 'region',
				measureMode: 'count',
				valueColumn: null,
				topN: 0,
				customTitle: '',
				chartHeight: 380,
				padding: 2,
				showLabels: true,
				showValues: false,
				colorMode: 'scheme',
				color: '#4e79a7',
				colorScheme: 'Bold',
				...overrides,
			},
		},
	};
}

function createContext({ categories = ['region'], numeric = ['sales'], allColumns = [] } = {}) {
	return {
		baseCategoricalOrAll: categories,
		categorical: categories,
		numeric,
		allColumns,
		dates: [],
		rows: [],
	};
}

function buildControls(dataset, writer = createWriter(), context = createContext()) {
	return buildDescribedControls(TREEMAP_CONTROLS, { dataset, context, writer, translate: key => key });
}

/** Build the controls into the document, as the sidebar does after each commit. */
function mountControls(dataset, writer = createWriter(), context = createContext()) {
	document.body.replaceChildren(...buildControls(dataset, writer, context));
	return writer;
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

function applyLastCommit(dataset, writer) {
	Object.assign(dataset.chartConfig.treemap, lastConfig(writer));
}

function presetButton(name) {
	return document.querySelector(`button[data-color-preset-control="viz-treemap-color-preset"][data-preset-name="${name}"]`);
}

function markedPresets() {
	return [...document.querySelectorAll('button[data-color-preset-control="viz-treemap-color-preset"]')]
		.filter(button => button.style.border.startsWith('2px'))
		.map(button => button.dataset.presetName);
}

function extractStructure(controls) {
	return controls.map(section => {
		const content = section.querySelector('.chart-section-content');
		const controlKeys = Array.from(content.children).map(control => {
			const idElement = control.matches('[id]') ? control : control.querySelector('[id]');
			const presetElement = control.querySelector('[data-color-preset-control]');
			const stateElement = idElement ?? presetElement ?? control.querySelector('button,input,select');
			const entry = {
				id: idElement?.id ?? presetElement?.dataset.colorPresetControl,
				disabled: stateElement?.disabled === true,
			};
			expect(entry.id).toBeDefined();
			return entry;
		});

		return {
			section: section.dataset.section,
			expanded: section.querySelector('.chart-section-header').getAttribute('aria-expanded'),
			controlKeys,
		};
	});
}

describe('treemap controls module boundaries', () => {
	it('declares its controls as descriptions, with no builder or listener module', async () => {
		const descriptions = await import('../../../src/charts/treemap/controls/descriptions.js');
		expect(Object.keys(descriptions)).toEqual(['TREEMAP_CONTROLS']);
		expect(TREEMAP_CONTROLS.definition).toBe(TREEMAP_DEFINITION);
	});
});

describe('treemapControls section structure', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('matches the section/control-order and disabled-state snapshot across measure and color modes', () => {
		// Drive both dynamic dimensions: measureMode (count disables the
		// value-column select) and colorMode (scheme disables the uniform-color
		// input), so the snapshot pins each conditional disabled slot.
		const byMode = {};
		for (const measureMode of ['count', 'sum']) {
			for (const colorMode of ['scheme', 'uniform']) {
				const dataset = createDataset({ measureMode, colorMode, valueColumn: 'sales' });
				const context = createContext({ categories: ['region', 'team'], allColumns: ['region', 'team', 'sales'] });
				byMode[`${measureMode}-${colorMode}`] = extractStructure(buildControls(dataset, createWriter(), context));
			}
		}

		expect(byMode).toMatchSnapshot();
	});
});

describe('treemapControls UI structure', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('prepends a none option to the category select', () => {
		mountControls(createDataset(), createWriter(), createContext({ categories: ['region', 'team'] }));

		const values = Array.from(document.getElementById('viz-select-treemap-category').options).map(o => o.value);
		expect(values).toEqual(['', 'region', 'team']);
	});

	it('offers the color modes and measures the treemap definition lists', () => {
		mountControls(createDataset());

		const values = id => Array.from(document.getElementById(id).options).map(o => o.value);
		expect(values('viz-select-treemap-color-mode')).toEqual(TREEMAP_DEFINITION.allowedValues.colorMode);
		expect(values('viz-select-treemap-measure')).toEqual(TREEMAP_DEFINITION.allowedValues.measureMode);
	});

	it('disables the uniform-color input when colorMode is scheme', () => {
		mountControls(createDataset({ colorMode: 'scheme' }));
		expect(document.getElementById('viz-input-treemap-color').disabled).toBe(true);

		mountControls(createDataset({ colorMode: 'uniform' }));
		expect(document.getElementById('viz-input-treemap-color').disabled).toBe(false);
	});

	it('renders fallback values and disabled controls for invalid config', () => {
		mountControls(createDataset({
			enabled: false,
			valueColumn: 'old',
			padding: 0,
			colorMode: '',
			colorScheme: '',
		}));

		expect(document.getElementById('viz-select-treemap-value-column').value).toBe('');
		expect(document.getElementById('viz-slider-treemap-padding').value).toBe('2');
		expect(document.getElementById('viz-select-treemap-color-mode').value).toBe('scheme');
		expect(document.getElementById('viz-select-treemap-category').disabled).toBe(true);
		expect(presetButton('Bold').disabled).toBe(true);
	});
});

describe('treemapControls writes', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('keeps valueColumn when measure flips back to count', () => {
		const writer = mountControls(createDataset({ measureMode: 'sum', valueColumn: 'sales' }));

		selectValue('viz-select-treemap-measure', 'count');

		expect(writer.commit).toHaveBeenCalledWith({ measureMode: 'count', valueColumn: 'sales' });
		expect(writer.commit).toHaveBeenCalledTimes(1);
	});

	it('takes the first numeric column when switching to sum without a valueColumn', () => {
		const writer = mountControls(
			createDataset({ measureMode: 'count', valueColumn: null }),
			createWriter(),
			createContext({ numeric: ['sales', 'profit'] }),
		);

		selectValue('viz-select-treemap-measure', 'sum');

		expect(writer.commit).toHaveBeenCalledWith({ measureMode: 'sum', valueColumn: 'sales' });
	});

	it('keeps a valid valueColumn when measure switches to sum', () => {
		const writer = mountControls(createDataset({ measureMode: 'count', valueColumn: 'sales' }));

		selectValue('viz-select-treemap-measure', 'sum');

		expect(writer.commit).toHaveBeenCalledWith({ measureMode: 'sum', valueColumn: 'sales' });
	});

	it('picks the value column from the config when the measure changes, not the config it was built from', () => {
		const dataset = createDataset({ measureMode: 'count', valueColumn: 'sales' });
		const writer = mountControls(dataset, createWriter(), createContext({ numeric: ['sales', 'profit'] }));

		dataset.chartConfig = { treemap: { ...dataset.chartConfig.treemap, valueColumn: 'profit' } };
		selectValue('viz-select-treemap-measure', 'sum');

		expect(writer.commit).toHaveBeenCalledWith({ measureMode: 'sum', valueColumn: 'profit' });
	});

	it('commits topN change with a coerced number value', () => {
		const writer = mountControls(createDataset());

		selectValue('viz-select-treemap-topn', '20');

		expect(writer.commit).toHaveBeenCalledWith({ topN: 20 });
	});

	it('color preset button commits both colorScheme and the first palette color', () => {
		const writer = mountControls(createDataset());

		presetButton('Bold').click();

		expect(writer.commit).toHaveBeenCalledTimes(1);
		const call = writer.commit.mock.calls[0][0];
		expect(call.colorScheme).toBe('Bold');
		expect(call.color).toMatch(/^#[0-9a-fA-F]{6}$/);
	});

	it('previews the uniform color while the picker is open and commits it when it closes', () => {
		const writer = mountControls(createDataset({ colorMode: 'uniform' }));
		const input = document.getElementById('viz-input-treemap-color');

		input.value = '#123456';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		expect(writer.preview).toHaveBeenCalledWith({ color: '#123456' });
		expect(writer.commit).not.toHaveBeenCalled();

		input.dispatchEvent(new Event('change', { bubbles: true }));
		expect(writer.commit).toHaveBeenCalledWith({ color: '#123456' });
	});

	it('commits category, value, title, padding, and toggle changes', () => {
		const writer = mountControls(createDataset({ measureMode: 'sum', valueColumn: 'sales' }));

		selectValue('viz-select-treemap-category', '');
		expect(lastConfig(writer).category).toBeNull();

		selectValue('viz-select-treemap-value-column', 'old');
		expect(lastConfig(writer).valueColumn).toBeNull();

		const title = document.getElementById('viz-input-treemap-title');
		title.value = '  Custom treemap  ';
		title.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer).customTitle).toBe('Custom treemap');

		const padding = document.getElementById('viz-slider-treemap-padding');
		padding.value = '5';
		padding.dispatchEvent(new Event('input', { bubbles: true }));
		expect(padding.parentElement.querySelector('output').textContent).toBe('5');
		padding.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer).padding).toBe(5);

		const labels = document.getElementById('viz-toggle-treemap-labels');
		labels.checked = false;
		labels.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer).showLabels).toBe(false);

		const values = document.getElementById('viz-toggle-treemap-values');
		values.checked = true;
		values.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer).showValues).toBe(true);

		expect(writer.commit).toHaveBeenCalledTimes(6);
	});

	it('commits forged measure and color-mode selections as chosen', () => {
		const writer = mountControls(createDataset({ measureMode: 'sum', valueColumn: 'old' }));

		// The commit canonicalizes the config, which stores a measure the
		// treemap does not offer as count. Like count, it keeps the value column.
		selectValue('viz-select-treemap-measure', 'invalid');
		expect(lastConfig(writer)).toEqual({ measureMode: 'invalid', valueColumn: 'old' });

		selectValue('viz-select-treemap-measure', 'sum');
		expect(lastConfig(writer)).toEqual({ measureMode: 'sum', valueColumn: 'sales' });

		selectValue('viz-select-treemap-color-mode', 'uniform');
		expect(lastConfig(writer).colorMode).toBe('uniform');

		selectValue('viz-select-treemap-color-mode', 'unexpected');
		// The commit canonicalizes the color mode too.
		expect(lastConfig(writer).colorMode).toBe('unexpected');
	});
});

describe('treemapControls color palette mark', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('marks the stored palette in scheme mode, which is the one the treemap draws', () => {
		const { colorMode, colorScheme } = TREEMAP_DEFINITION.createDefaultConfig();
		mountControls(createDataset({ colorMode, colorScheme }));

		expect(markedPresets()).toEqual([colorScheme]);
	});

	it('in uniform mode, marks a palette only while the color its button set is unchanged', () => {
		const { color, colorScheme } = TREEMAP_DEFINITION.createDefaultConfig();
		const dataset = createDataset({ colorMode: 'uniform', color, colorScheme });
		const writer = createWriter();
		mountControls(dataset, writer);
		expect(markedPresets()).toEqual([]);

		presetButton('Pastel').click();
		applyLastCommit(dataset, writer);
		mountControls(dataset, writer);
		expect(markedPresets()).toEqual(['Pastel']);

		const colorInput = document.getElementById('viz-input-treemap-color');
		colorInput.value = '#123456';
		colorInput.dispatchEvent(new Event('change'));
		applyLastCommit(dataset, writer);
		mountControls(dataset, writer);
		expect(markedPresets()).toEqual([]);
	});
});
