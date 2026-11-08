// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NETWORK_CONTROLS } from '../../../src/charts/network/controls/descriptions.js';
import { computeDefaults } from '../../../src/charts/network/controls/activationDefaults.js';
import { buildDescribedControls } from '../../../src/charts/shared/controls/describedControls.js';
import { COLOR_PRESETS } from '../../../src/charts/shared/controls/factories.js';
import { NETWORK_DEFINITION, NETWORK_GRAPH } from '../../../src/config/charts/definitions/network.js';

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
			network: {
				enabled: true,
				expanded: true,
				source: 'from',
				target: 'to',
				weight: null,
				group: null,
				linkDistance: 60,
				zoomScale: 1,
				showLegend: true,
				customTitle: '',
				chartHeight: 420,
				showNodeLabels: true,
				nodeRadius: 5,
				linkOpacity: 0.6,
				sourceNodeColor: '#e3743d',
				targetNodeColor: '#6b94c9',
				edgeColorMode: 'gradient',
				colorScheme: 'Bold',
				chargeStrength: -120,
				alphaDecay: 0.05,
				...overrides,
			},
		},
	};
}

function createContext({ allColumns = ['from', 'to', 'weight'], numeric = ['weight'], categorical = ['from', 'to'] } = {}) {
	return {
		allColumns,
		numeric,
		categorical,
		baseCategoricalOrAll: categorical.length > 0 ? categorical : allColumns,
		dates: [],
		rows: [],
	};
}

function buildControls(dataset, writer = createWriter(), context = createContext(), translate = key => key) {
	return buildDescribedControls(NETWORK_CONTROLS, { dataset, context, writer, translate });
}

/** Build the controls into the document, as the sidebar does after each commit. */
function mountControls(dataset, writer = createWriter(), context = createContext()) {
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
	Object.assign(dataset.chartConfig.network, lastConfig(writer));
}

function presetButton(name) {
	return document.querySelector(`button[data-color-preset-control="viz-network-color-preset"][data-preset-name="${name}"]`);
}

function markedPresets() {
	return [...document.querySelectorAll('button[data-color-preset-control="viz-network-color-preset"]')]
		.filter(button => button.style.border.startsWith('2px'))
		.map(button => button.dataset.presetName);
}

const optionValues = id => Array.from(document.getElementById(id).options, option => option.value);

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

describe('network controls module boundaries', () => {
	it('declares its controls as descriptions, with no builder or listener module', async () => {
		const [descriptions, defaults] = await Promise.all([
			import('../../../src/charts/network/controls/descriptions.js'),
			import('../../../src/charts/network/controls/activationDefaults.js'),
		]);
		expect(Object.keys(descriptions)).toEqual(['NETWORK_CONTROLS']);
		expect(Object.keys(defaults)).toEqual(['computeDefaults']);
		expect(NETWORK_CONTROLS.definition).toBe(NETWORK_DEFINITION);
	});
});

describe('networkControls section structure', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('matches the section/control-order and disabled-state snapshot', () => {
		// The four sections (Data/Display/Styling/Advanced) are static and the
		// only disabled dimension is the global enabled flag, so one enabled
		// dataset pins the section order, the reset-zoom button slot, and the
		// color-preset slot.
		expect(extractStructure(buildControls(createDataset()))).toMatchSnapshot();
	});
});

describe('networkControls UI structure', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('offers every visible column for source/target, numeric columns for weight and categorical ones for group', () => {
		mountControls(createDataset());

		expect(optionValues('viz-select-network-source')).toEqual(['', 'from', 'to', 'weight']);
		expect(optionValues('viz-select-network-target')).toEqual(['', 'from', 'to', 'weight']);
		expect(optionValues('viz-select-network-weight')).toEqual(['', 'weight']);
		expect(optionValues('viz-select-network-group')).toEqual(['', 'from', 'to']);
	});

	it('offers the edge color modes the network definition lists, each with its label', () => {
		mountControls(createDataset());

		expect(optionValues('viz-select-network-edge-color-mode')).toEqual(NETWORK_DEFINITION.allowedValues.edgeColorMode);
		expect(Array.from(document.getElementById('viz-select-network-edge-color-mode').options, option => option.textContent))
			.toEqual(['chive-chart-color-gradient', 'chive-chart-color-uniform']);
	});

	it('shows "None" for unset columns, even beside columns named "null" and "undefined"', () => {
		mountControls(
			createDataset({ source: null, target: undefined, weight: undefined, group: null }),
			createWriter(),
			createContext({ allColumns: ['null', 'undefined'], numeric: ['undefined'], categorical: ['null'] }),
		);

		for (const id of ['viz-select-network-source', 'viz-select-network-target', 'viz-select-network-weight', 'viz-select-network-group']) {
			expect(document.getElementById(id).selectedIndex).toBe(0);
		}
	});

	it('shows each slider setting as a number', () => {
		mountControls(createDataset({ linkDistance: '80', zoomScale: '2.5', chargeStrength: undefined }));

		const output = id => document.getElementById(id).parentElement.querySelector('output').textContent;
		expect(output('viz-slider-network-link-distance')).toBe('80');
		expect(output('viz-slider-network-zoom')).toBe('2.5');
		expect(output('viz-slider-network-charge')).toBe('NaN');
	});

	it.each([
		['viz-slider-network-link-distance', '20', '140', '1'],
		['viz-slider-network-zoom', String(NETWORK_GRAPH.minZoomScale), String(NETWORK_GRAPH.maxZoomScale), '0.05'],
		['viz-slider-network-node-radius', '3', '12', '1'],
		['viz-slider-network-link-opacity', '0.1', '1', '0.05'],
		['viz-slider-network-charge', '-300', '-20', '10'],
		['viz-slider-network-alpha-decay', String(NETWORK_GRAPH.minAlphaDecay), String(NETWORK_GRAPH.maxAlphaDecay), '0.01'],
	])('gives %s the range min %s, max %s, step %s', (id, min, max, step) => {
		mountControls(createDataset());

		const slider = document.getElementById(id);
		expect([slider.min, slider.max, slider.step]).toEqual([min, max, step]);
	});

	it('disables every control while the chart is off', () => {
		mountControls(createDataset({ enabled: false }));

		const states = [...document.querySelectorAll('.chart-section-content :is(select, input, button)')].map(element => element.disabled);
		// 16 selects and inputs, the reset-zoom button and the palette buttons.
		expect(states).toHaveLength(17 + Object.keys(COLOR_PRESETS).length);
		expect(states.every(Boolean)).toBe(true);
	});
});

describe('networkControls writes', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('commits the source and target as chosen, the empty string for none', () => {
		const writer = mountControls(createDataset());

		selectValue('viz-select-network-target', 'weight');
		expect(lastConfig(writer)).toEqual({ target: 'weight' });
		selectValue('viz-select-network-source', '');
		expect(lastConfig(writer)).toEqual({ source: '' });
		expect(writer.commit).toHaveBeenCalledTimes(2);
	});

	it('stores null for no weight or group column', () => {
		const writer = mountControls(createDataset({ weight: 'weight', group: 'from' }));

		selectValue('viz-select-network-weight', '');
		expect(lastConfig(writer)).toEqual({ weight: null });
		selectValue('viz-select-network-group', '');
		expect(lastConfig(writer)).toEqual({ group: null });
		selectValue('viz-select-network-group', 'to');
		expect(lastConfig(writer)).toEqual({ group: 'to' });
	});

	// The commit canonicalizes the chart's config, which replaces a value the
	// network does not offer.
	it('commits the edge color mode as chosen, a forged one included', () => {
		const writer = mountControls(createDataset());

		selectValue('viz-select-network-edge-color-mode', 'uniform');
		expect(lastConfig(writer)).toEqual({ edgeColorMode: 'uniform' });
		selectValue('viz-select-network-edge-color-mode', 'made-up');
		expect(lastConfig(writer)).toEqual({ edgeColorMode: 'made-up' });
	});

	it.each([
		['viz-slider-network-link-distance', 'linkDistance', '90', 90],
		['viz-slider-network-zoom', 'zoomScale', '2.25', 2.25],
		['viz-slider-network-node-radius', 'nodeRadius', '9', 9],
		['viz-slider-network-link-opacity', 'linkOpacity', '0.75', 0.75],
		['viz-slider-network-charge', 'chargeStrength', '-200', -200],
		['viz-slider-network-alpha-decay', 'alphaDecay', '0.12', 0.12],
	])('follows the %s drag in its output and commits a number on release', (id, key, value, stored) => {
		const writer = mountControls(createDataset());
		const slider = document.getElementById(id);

		slider.value = value;
		slider.dispatchEvent(new Event('input', { bubbles: true }));
		expect(slider.parentElement.querySelector('output').textContent).toBe(value);
		expect(writer.commit).not.toHaveBeenCalled();

		slider.dispatchEvent(new Event('change', { bubbles: true }));
		expect(writer.commit).toHaveBeenCalledWith({ [key]: stored });
	});

	it('puts the zoom slider back to the default zoom and commits it on reset', () => {
		const writer = mountControls(createDataset({ zoomScale: 2 }));
		const slider = document.getElementById('viz-slider-network-zoom');

		document.getElementById('viz-btn-network-reset-zoom').click();

		expect(writer.commit).toHaveBeenCalledTimes(1);
		expect(lastConfig(writer)).toEqual({ zoomScale: NETWORK_GRAPH.defaultZoomScale });
		expect(slider.value).toBe(String(NETWORK_GRAPH.defaultZoomScale));
		expect(slider.parentElement.querySelector('output').textContent).toBe(String(NETWORK_GRAPH.defaultZoomScale));
	});

	it('copies a palette into the source and target node colors', () => {
		const writer = mountControls(createDataset());

		presetButton('Bold').click();

		expect(writer.commit).toHaveBeenCalledTimes(1);
		expect(lastConfig(writer)).toEqual({
			colorScheme: 'Bold',
			sourceNodeColor: COLOR_PRESETS.Bold[0],
			targetNodeColor: COLOR_PRESETS.Bold[1],
		});
	});

	it('previews a node color while the picker is open, and commits it, or its fallback, when it closes', () => {
		const writer = mountControls(createDataset());
		const source = document.getElementById('viz-input-network-source-color');

		source.value = '#123456';
		source.dispatchEvent(new Event('input', { bubbles: true }));
		expect(writer.preview).toHaveBeenCalledWith({ sourceNodeColor: '#123456' });
		expect(writer.commit).not.toHaveBeenCalled();

		const target = document.getElementById('viz-input-network-target-color');
		target.type = 'text';
		target.value = 'not-a-color';
		target.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual({ targetNodeColor: '#6b94c9' });
	});

	it('commits the legend and node-label toggles and the trimmed title', () => {
		const writer = mountControls(createDataset());

		document.getElementById('viz-toggle-network-show-legend').click();
		expect(lastConfig(writer)).toEqual({ showLegend: false });
		document.getElementById('viz-toggle-network-node-labels').click();
		expect(lastConfig(writer)).toEqual({ showNodeLabels: false });

		const title = document.getElementById('viz-input-network-title');
		title.value = '  Trade links  ';
		title.dispatchEvent(new Event('change', { bubbles: true }));
		expect(lastConfig(writer)).toEqual({ customTitle: 'Trade links' });
	});
});

describe('networkControls color palette mark', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('marks no palette on a new chart', () => {
		const { colorScheme, sourceNodeColor, targetNodeColor } = NETWORK_DEFINITION.createDefaultConfig();
		mountControls(createDataset({ colorScheme, sourceNodeColor, targetNodeColor }));

		expect(markedPresets()).toEqual([]);
	});

	it('marks a palette once its button applies it, until a node color is edited', () => {
		const dataset = createDataset();
		const writer = createWriter();
		mountControls(dataset, writer);

		presetButton('Pastel').click();
		applyLastCommit(dataset, writer);
		mountControls(dataset, writer);
		expect(markedPresets()).toEqual(['Pastel']);

		const targetInput = document.getElementById('viz-input-network-target-color');
		targetInput.value = '#123456';
		targetInput.dispatchEvent(new Event('change'));
		applyLastCommit(dataset, writer);
		mountControls(dataset, writer);
		expect(markedPresets()).toEqual([]);
	});
});

describe('networkControls computeDefaults', () => {
	it('preserves the current source/target when both are still in scope', () => {
		const dataset = createDataset({ source: 'from', target: 'to' });
		const ctx = { allColumns: ['from', 'to', 'extra'] };
		expect(computeDefaults(dataset, ctx)).toEqual({ source: 'from', target: 'to' });
	});

	it('falls back to the first two distinct columns when the current values are out of scope', () => {
		const dataset = createDataset({ source: 'gone', target: 'missing' });
		const ctx = { allColumns: ['alpha', 'beta', 'gamma'] };
		expect(computeDefaults(dataset, ctx)).toEqual({ source: 'alpha', target: 'beta' });
	});

	it('returns null when there are no columns', () => {
		const dataset = createDataset();
		expect(computeDefaults(dataset, { allColumns: [] })).toEqual({ source: null, target: null });
	});
});
